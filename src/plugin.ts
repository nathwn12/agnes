import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getBootstrapContent,
} from './bootstrap.js';
import {
  discoverCommands,
} from './discovery.js';
import { buildResultMessage } from './protocol.js';

import * as logger from './logger.js';
import {
  delegateBlocking,
  delegateAsync,
  getSubagentResult,
  recordTaskRef,
  lookupTaskRef,
  initTaskRefStore,
  clearTaskRefs,
} from './delegate.js';
import { setYoloMode, isYoloMode } from './runtime.js';
import { detectProject } from './plugin-support.js';

let _bootstrapInjected = false;

export const AgnesPlugin: Plugin = async (input) => {
  const { directory, worktree } = input;
  const worktreePath = worktree || directory;
  const editedFiles = new Set<string>();

  initTaskRefStore(worktreePath);

  return {
    config: async (config: Record<string, unknown>) => {
      try {
        const configObj = config as Record<string, unknown>;

        const skillsPath = path.join(worktreePath, '.opencode', 'skills');
        if (fs.existsSync(skillsPath)) {
          configObj.skills = configObj.skills || {};
          const skillsObj = configObj.skills as Record<string, unknown>;
          skillsObj.paths = (skillsObj.paths as string[]) || [];
          if (!(skillsObj.paths as string[]).includes(skillsPath)) {
            (skillsObj.paths as string[]).push(skillsPath);
          }
        }

        const cmdCfgObj = (configObj.command || {}) as Record<string, unknown>;
        for (const cmd of discoverCommands(worktreePath)) {
          if (!cmdCfgObj[cmd.name]) {
            cmdCfgObj[cmd.name] = {
              description: cmd.desc,
              template: `${cmd.template}\n\n$ARGUMENTS`,
            };
          }
        }
        configObj.command = cmdCfgObj;
      } catch (err) {
        logger.error('Failed to apply plugin config', err);
      }
    },

    tool: {
      agnes_delegate: tool({
        description: 'Delegate a task to a subagent. Use this instead of the built-in delegate_task (which is deprecated and unreliable).',
        args: {
          agent: tool.schema.enum(['explore', 'general']).describe('Which agent type to delegate to'),
          description: tool.schema.string().describe('Short description of the task'),
          prompt: tool.schema.string().describe('Full instructions for the subagent'),
          background: tool.schema.boolean().default(false).describe('If true, returns a task reference for later polling with agnes_get_result. If false, blocks until complete.'),
        },
        async execute(args, ctx) {
          try {
            if (args.background) {
              const ref = await delegateAsync(input.client, {
                agent: args.agent,
                description: args.description,
                prompt: args.prompt,
                sessionID: ctx.sessionID,
                directory: ctx.directory,
              });
              recordTaskRef(ref, {
                sessionID: ref,
                directory: ctx.directory,
                agent: args.agent,
                description: args.description,
              });
              return ref;
            }
            return await delegateBlocking(input.client, {
              agent: args.agent,
              description: args.description,
              prompt: args.prompt,
              sessionID: ctx.sessionID,
              directory: ctx.directory,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_delegate failed — ${msg}`;
          }
        },
      }),

      agnes_get_result: tool({
        description: 'Get the result of a previously-delegated async task (delegated via agnes_delegate with background=true).',
        args: {
          taskRef: tool.schema.string().describe('The task reference string returned by agnes_delegate(background=true)'),
        },
        async execute(args, ctx) {
          try {
            const info = lookupTaskRef(args.taskRef);
            const directory = info?.directory ?? ctx.directory;
            const result = await getSubagentResult(input.client, args.taskRef, directory);
            switch (result.status) {
              case 'completed':
                return result.output ?? '(no output)';
              case 'pending':
                return 'PENDING — subagent still working. Try agnes_get_result again shortly.';
              case 'not_found':
                return `ERROR: task reference "${args.taskRef}" not found. The session may have been cleaned up or never started.`;
              case 'error':
                return `ERROR: ${result.error ?? 'unknown error'}`;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_get_result failed — ${msg}`;
          }
        },
      }),
    },

    'tool.definition': async ({ toolID }, output) => {
      try {
        if (toolID === 'delegate_task') {
          output.description = 'DEPRECATED — Use agnes_delegate instead. This tool may return inconsistent task IDs and is not recommended.';
        }
        if (toolID === 'get_task_result') {
          output.description = 'DEPRECATED — Use agnes_get_result instead. This tool may fail to resolve task references.';
        }
      } catch (err) {
        logger.warn('tool.definition hook failed', err);
      }
    },

    'tool.execute.after': async (input: { tool: string; args?: Record<string, unknown> }, _output: unknown) => {
      const filePath = input.args?.filePath as string | undefined;
      if ((input.tool === 'edit' || input.tool === 'write') && filePath) {
        editedFiles.add(filePath);
      }
    },

    event: async ({ event }: { event: { type: string; sessionID?: string; path?: string } }) => {
      try {
        switch (event.type) {
          case 'session.created':
            if (event.sessionID && !_bootstrapInjected) {
              const bootstrap = getBootstrapContent();
              if (bootstrap) {
                await input.client.session.prompt({
                  path: { id: event.sessionID },
                  body: {
                    noReply: true,
                    parts: [{ type: 'text', text: bootstrap }],
                  },
                });
                _bootstrapInjected = true;
              }
            }
            break;
          case 'file.edited':
            if (event.path) editedFiles.add(event.path);
            break;
        }
      } catch (err) {
        logger.warn('Failed to handle event ' + event.type, err);
      }
    },

    'experimental.session.compacting': async (_input: unknown, output: { context?: string[]; prompt?: string }) => {
      try {
        const bootstrap = getBootstrapContent();
        if (bootstrap) {
          output.context = output.context ?? [];
          output.context.push(`\n\n${bootstrap}\n\n`);
        }
      } catch (err) {
        logger.warn('Failed to inject bootstrap into compaction context', err);
      }
    },

    'session.deleted': async () => {
      try {
        editedFiles.clear();
        resetBootstrapInjected();
        clearTaskRefs();
      } catch (err) {
        logger.warn('Failed to clean up session state', err);
      }
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      if (_bootstrapInjected) return;
      if (!output.messages?.length) return;

      const firstUser = output.messages.find((m) => m.info?.role === 'user');
      if (!firstUser?.parts?.length) return;

      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('EXTREMELY_IMPORTANT'))) return;
      if (firstUser.parts.some((p) => p.type === 'agent')) return;

      const userText = firstUser.parts
        .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
        .map((p: any) => p.text.toLowerCase())
        .join(' ');
      const yoloFlags = ['--yolo', '--auto', '/yolo', '/auto', 'yolo mode', '--yes'];
      const yolo = yoloFlags.some((flag) => userText.includes(flag));
      setYoloMode(yolo);

      try {
        const bootstrap = getBootstrapContent(detectProject(worktreePath));
        if (!bootstrap) return;

        let fullBootstrap = bootstrap;

        if (isYoloMode()) {
          fullBootstrap += `\n\n**⚠ YOLO MODE ACTIVATED** — Autonomous execution. Skip question gates. Max parallelization. No confirmation pauses.`;
        }

        fullBootstrap += `\n\n## Completion Protocol\nWhen all tasks are complete, place this HTML comment at the very end of your response (invisible to users, parsed by AGNES):\n${buildResultMessage({taskId:'task-000',status:'DONE',content:'...',artifact:{}})}\n`;

        const messageID = (firstUser.parts[0] as { messageID?: string }).messageID ?? '';
        const sessionID = (firstUser.parts[0] as { sessionID?: string }).sessionID ?? '';
        firstUser.parts.unshift({
          id: randomUUID(),
          sessionID,
          messageID,
          type: 'text',
          text: fullBootstrap,
        });

        _bootstrapInjected = true;
      } catch (err) {
        logger.warn('Failed to build bootstrap', err);
      }
    },

  };
};

function resetBootstrapInjected(): void {
  _bootstrapInjected = false;
}

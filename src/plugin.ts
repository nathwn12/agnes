import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import {
  getBootstrapContent,
  getBootstrapPackageInfo,
} from './bootstrap.js';
import {
  discoverCommands,
} from './discovery.js';
import { serializeAgnesMessage } from './protocol.js';
import {
  buildCompactionContext,
  detectProject,
} from './plugin-support.js';
import type { ProjectProfile } from './plugin-support.js';
import * as logger from './logger.js';
import {
  delegateBlocking,
  delegateAsync,
  getSubagentResult,
  recordTaskRef,
  lookupTaskRef,
} from './delegate.js';

let _plannerMode: 'auto' | 'builtin' | 'full' = 'auto';
const _injectedSessions = new Set<string>();

export const AgnesPlugin: Plugin = async (input) => {
  const { directory, worktree } = input;
  const worktreePath = worktree || directory;
  const editedFiles = new Set<string>();
  let projectProfile: ProjectProfile | null = null;

  return {
    config: async (config: Record<string, unknown>) => {
      try {
        const configObj = config as Record<string, unknown>;

        const plannerConfig = (configObj.planner as Record<string, unknown> | undefined) ?? {};
        _plannerMode = typeof plannerConfig.mode === 'string' && ['auto', 'builtin', 'full'].includes(plannerConfig.mode)
          ? plannerConfig.mode as 'auto' | 'builtin' | 'full'
          : 'auto';
        configObj.planner = {
          ...plannerConfig,
          mode: _plannerMode,
        } as Record<string, unknown>;

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

    'session.created': async (_event: any) => {
      try {
        projectProfile = detectProject(worktreePath);
      } catch (err) {
        logger.warn('Failed to detect project profile', err);
      }
    },

    tool: {
      agnes_delegate: tool({
        description: 'Delegate a task to a subagent. Use this instead of the built-in delegate_task (which is deprecated and unreliable).',
        args: {
          agent: tool.schema.enum(['explore', 'general', 'build', 'plan']).describe('Which agent type to delegate to'),
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
      if (toolID === 'delegate_task') {
        output.description = 'DEPRECATED — Use agnes_delegate instead. This tool may return inconsistent task IDs and is not recommended.';
      }
      if (toolID === 'get_task_result') {
        output.description = 'DEPRECATED — Use agnes_get_result instead. This tool may fail to resolve task references.';
      }
    },

    'file.edited': async (event: { path: string }) => {
      editedFiles.add(event.path);
    },

    'tool.execute.after': async (input: { tool: string; args?: Record<string, unknown> }, _output: unknown) => {
      const filePath = input.args?.filePath as string | undefined;
      if ((input.tool === 'edit' || input.tool === 'write') && filePath) {
        editedFiles.add(filePath);
      }
    },

    'session.deleted': async (_event: any) => {
      try {
        editedFiles.clear();
        projectProfile = null;
        _injectedSessions.clear();
      } catch (err) {
        logger.warn('Failed to clean up session state', err);
      }
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      if (!output.messages?.length) return;

      const firstUser = output.messages.find((m) => m.info?.role === 'user');
      if (!firstUser?.parts?.length) return;

      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('EXTREMELY_IMPORTANT'))) return;
      if (firstUser.parts.some((p) => p.type === 'agent')) return;

      const injectionSessionID = (firstUser.parts[0] as { sessionID?: string }).sessionID ?? '';
      if (injectionSessionID && _injectedSessions.has(injectionSessionID)) return;
      if (injectionSessionID) _injectedSessions.add(injectionSessionID);

      try {
        const bootstrap = getBootstrapContent();
        if (!bootstrap) return;

        let fullBootstrap = bootstrap;

        fullBootstrap += `\n\n## Completion Protocol\nWhen all tasks are complete, place this HTML comment at the very end of your response (invisible to users, parsed by AGNES):\n${serializeAgnesMessage({type:'completion',id:randomUUID(),timestamp:new Date().toISOString(),status:'DONE',summary:'all tasks completed successfully'})}\nFor partial results:\n${serializeAgnesMessage({type:'result',taskId:'task-000',id:randomUUID(),timestamp:new Date().toISOString(),status:'DONE',content:'...',artifact:{}})}\n`;

        const messageID = (firstUser.parts[0] as { messageID?: string }).messageID ?? '';
        firstUser.parts.unshift({
          id: randomUUID(),
          sessionID: injectionSessionID,
          messageID,
          type: 'text',
          text: fullBootstrap,
        });
      } catch (err) {
        logger.warn('Failed to build bootstrap', err);
      }
    },

    'experimental.session.compacting': async (_input: any, output: any) => {
      try {
        const pkg = getBootstrapPackageInfo();
        for (const line of buildCompactionContext({ pkg, projectProfile, editedFiles })) {
          output.context.push(line);
        }
      } catch (err) {
        logger.warn('Failed to build compaction context', err);
      }
    },

  };
};

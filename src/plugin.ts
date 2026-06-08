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
import { setYoloMode, isYoloMode, setModelId, detectModelTier } from './runtime.js';
import { detectProject } from './plugin-support.js';
import {
  createOrchestration,
  advanceOrchestration,
} from './orchestrator.js';

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

      agnes_orchestrate: tool({
        description: 'Execute a full plan → decompose → delegate → review → iterate cycle. Use for multi-file features or complex tasks that benefit from parallel subagents and iterative review.',
        args: {
          goal: tool.schema.string().describe('The goal or feature to implement'),
          tasksJSON: tool.schema.string().optional().describe('JSON array of tasks. Each task: { id, description, files: string[], dependsOn: string[], agent: "explore"|"general" }. If omitted, creates an empty plan for the model to populate.'),
          planID: tool.schema.string().optional().describe('Resume an existing plan by ID'),
          maxIterations: tool.schema.number().optional().default(3).describe('Max review→iterate cycles (default 3)'),
        },
        async execute(args, ctx) {
          try {
            let tasks;
            if (args.tasksJSON) {
              try {
                const parsed = JSON.parse(args.tasksJSON);
                if (!Array.isArray(parsed)) throw new Error('tasksJSON must be a JSON array');
                tasks = parsed;
              } catch (parseErr) {
                return `ERROR: invalid tasksJSON — ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`;
              }
            }

            const result = await createOrchestration(input.client, {
              goal: args.goal,
              tasks,
              planID: args.planID,
              maxIterations: args.maxIterations ?? 3,
              sessionID: ctx.sessionID,
              directory: ctx.directory,
            });

            return [
              `## Orchestration Created`,
              `**Plan:** ${result.planID}`,
              `**Goal:** ${result.goal}`,
              `**Phase:** ${result.phase}`,
              `**Tasks:** ${result.totalTasks} total, ${result.completedTasks} done, ${result.runningTasks} running, ${result.failedTasks} failed`,
              `**Wave:** ${result.currentWave}/${result.totalWaves}`,
              `**Edited files:** ${result.editedFiles.length > 0 ? result.editedFiles.join(', ') : '(none)'}`,
              result.error ? `**Error:** ${result.error}` : '',
              '',
              result.phase === 'completed'
                ? '✅ All tasks passed review.'
                : result.phase === 'failed'
                  ? '⚠ Orchestration failed.'
                  : '⏳ Orchestration is running — poll with agnes_orchestrate_status to check progress.',
            ].filter(Boolean).join('\n');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_orchestrate failed — ${msg}`;
          }
        },
      }),

      agnes_orchestrate_status: tool({
        description: 'Check status of an orchestration plan AND advance the state machine. Keeps calling until phase is "completed" or "failed".',
        args: {
          planID: tool.schema.string().describe('The plan ID returned by agnes_orchestrate'),
        },
        async execute(args, ctx) {
          try {
            const result = await advanceOrchestration(
              input.client,
              args.planID,
              ctx.directory,
              ctx.sessionID,
            );

            const details = result.editedFiles.length > 0
              ? `\n**Files edited:** ${result.editedFiles.join(', ')}`
              : '';

            const pendingInfo = result.pendingCalls > 0
              ? `\n**Pending subagent calls:** ${result.pendingCalls}`
              : '';

            return [
              `## Plan: ${result.planID}`,
              `**Phase:** ${result.phase}`,
              `**Goal:** ${result.goal}`,
              `**Iterations:** ${result.iterations}/${result.maxIterations}`,
              `**Tasks:** ${result.completedTasks}/${result.totalTasks} done, ${result.runningTasks} running, ${result.failedTasks} failed`,
              `**Wave:** ${result.currentWave}/${result.totalWaves}`,
              pendingInfo,
              details,
              result.error ? `**Error:** ${result.error}` : '',
              '',
              result.phase === 'completed'
                ? '✅ Plan completed successfully.'
                : result.phase === 'failed'
                  ? '⚠ Plan failed.'
                  : '⏳ Plan still running — check again with agnes_orchestrate_status.',
            ].filter(Boolean).join('\n');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_orchestrate_status failed — ${msg}`;
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

    'chat.message': async (input: { model?: { modelID: string } }) => {
      if (input.model?.modelID) {
        setModelId(input.model.modelID);
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
              const bootstrap = getBootstrapContent(undefined, detectModelTier());
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
        output.context = output.context ?? [];
        const bootstrap = getBootstrapContent(undefined, detectModelTier());
        if (bootstrap) {
          output.context.push(`\n\n${bootstrap}\n\n`);
        }
        if (editedFiles.size > 0) {
          const files = [...editedFiles].map(f => `- ${f}`).join('\n');
          output.context.push(`\nEdited files this session:\n${files}\n`);
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

      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('[AGNES v'))) return;
      if (firstUser.parts.some((p) => p.type === 'agent')) return;

      const userText = firstUser.parts
        .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
        .map((p: any) => p.text.toLowerCase())
        .join(' ');
      const yoloFlags = ['--yolo', '--auto', '/yolo', '/auto', 'yolo mode', '--yes'];
      const yolo = yoloFlags.some((flag) => userText.includes(flag));
      setYoloMode(yolo);

      try {
        const tier = detectModelTier();
        const bootstrap = getBootstrapContent(detectProject(worktreePath), tier);
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

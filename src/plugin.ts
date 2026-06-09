import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getStableTier,
  getContextTier,
  getVolatileTier,
} from './bootstrap.js';
import {
  discoverCommands,
  forceRescan as forceDiscoveryRescan,
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
  resetDepthTracking,
} from './delegate.js';
import { MemoryStore, extractLessons } from './memory.js';
import { TodoStore } from './todo.js';
import { setYoloMode, isYoloMode, setModelId, detectModelTier, getVersion } from './runtime.js';
import { getSessionSummary, setSessionSummary } from './compressor.js';
import { collectStatus } from './status.js';
import { detectProject } from './plugin-support.js';
import {
  createOrchestration,
  advanceOrchestration,
} from './orchestrator.js';
import { gcPlans } from './planner.js';
import {
  handleAutoDelegateAfter,
  handleAutoDelegateBefore,
  cleanupTmpFiles,
} from './auto-delegate.js';

const _bootstrapInjectedSessions = new Set<string>();

export const AgnesPlugin: Plugin = async (input) => {
  const { directory, worktree } = input;
  const worktreePath = worktree || directory;
  const editedFiles = new Set<string>();
  const memoryStore = new MemoryStore();
  const todoStore = new TodoStore();

  initTaskRefStore(worktreePath);
  memoryStore.load(worktreePath);
  todoStore.load(worktreePath);

  try { gcPlans(worktreePath); } catch { /* non-critical */ }

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
            const todoBlock = todoStore.formatForPrompt();
            const enrichedPrompt = todoBlock
              ? `${todoBlock}\n\n---\n\n${args.prompt}`
              : args.prompt;

            if (args.background) {
              const ref = await delegateAsync(input.client, {
                agent: args.agent,
                description: args.description,
                prompt: enrichedPrompt,
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
            const result = await delegateBlocking(input.client, {
              agent: args.agent,
              description: args.description,
              prompt: enrichedPrompt,
              sessionID: ctx.sessionID,
              directory: ctx.directory,
            });
            extractLessons(result, memoryStore);
            return result;
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
            const result2 = await getSubagentResult(input.client, args.taskRef, directory);
            if (result2.status === 'completed' && result2.output) {
              extractLessons(result2.output, memoryStore);
            }
            switch (result2.status) {
              case 'completed':
                return result2.output ?? '(no output)';
              case 'pending':
                return 'PENDING — subagent still working. Try agnes_get_result again shortly.';
              case 'not_found':
                return `ERROR: task reference "${args.taskRef}" not found. The session may have been cleaned up or never started.`;
              case 'error':
                return `ERROR: ${result2.error ?? 'unknown error'}`;
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

            const fallbackNote = result.failedTasks > 0
              ? `\n**⚠ ${result.failedTasks} task(s) failed — implement them directly using write/edit/bash.**`
              : '';
            const phaseMsg = result.phase === 'completed' && result.failedTasks === 0
              ? 'All tasks passed review.'
              : `${result.phase === 'failed' ? 'Orchestration failed' : 'Orchestration finished'} — ${result.failedTasks} task(s) failed. Implement them below.`;
            return [
              `## Orchestration Created`,
              `**Plan:** ${result.planID}`,
              `**Goal:** ${result.goal}`,
              `**Phase:** ${result.phase}`,
              `**Tasks:** ${result.totalTasks} total, ${result.completedTasks} done, ${result.runningTasks} running, ${result.failedTasks} failed`,
              `**Wave:** ${result.currentWave}/${result.totalWaves}`,
              `**Edited files:** ${result.editedFiles.length > 0 ? result.editedFiles.join(', ') : '(none)'}`,
              result.error ? `**Error:** ${result.error}` : '',
              fallbackNote,
              '',
              phaseMsg,
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

            const statusFallbackNote = result.failedTasks > 0
              ? `\n**⚠ ${result.failedTasks} task(s) failed — implement them directly using write/edit/bash.**`
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
              statusFallbackNote,
              '',
              result.phase === 'completed' && result.failedTasks === 0
                ? 'Plan completed successfully. All tasks passed review.'
                : result.phase === 'completed' || result.phase === 'failed'
                  ? `Plan finished — ${result.failedTasks} task(s) failed. Implement them directly.`
                  : 'Plan still running — check again with agnes_orchestrate_status.',
            ].filter(Boolean).join('\n');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_orchestrate_status failed — ${msg}`;
          }
        },
      }),

      agnes_memory: tool({
        description: 'Read or write AGNES persistent memory. Memory persists across sessions and is injected into bootstraps so the model can recall past outcomes, preferences, and patterns.',
        args: {
          action: tool.schema.enum(['get', 'set', 'delete', 'list']).describe('Action to perform'),
          key: tool.schema.string().optional().describe('Memory key (required for get/set/delete)'),
          value: tool.schema.string().optional().describe('Value to store (required for set)'),
          category: tool.schema.enum(['user', 'project', 'pattern', 'pref']).optional().describe('Category for the memory entry (default: user)'),
        },
        async execute(args) {
          try {
            switch (args.action) {
              case 'get': {
                if (!args.key) return 'ERROR: key is required for get';
                const entry = memoryStore.get(args.key);
                if (!entry) return `No memory found for key "${args.key}"`;
                return `[${entry.category}] ${entry.key}: ${entry.value}`;
              }
              case 'set': {
                if (!args.key || !args.value) return 'ERROR: key and value are required for set';
                const cat = args.category ?? 'user';
                const ok = memoryStore.set(args.key, args.value, cat);
                return ok
                  ? `Stored [${cat}] ${args.key}`
                  : 'ERROR: memory store full (max 50 entries)';
              }
              case 'delete': {
                if (!args.key) return 'ERROR: key is required for delete';
                memoryStore.delete(args.key);
                return `Deleted "${args.key}"`;
              }
              case 'list': {
                const entries = memoryStore.list(args.category);
                if (entries.length === 0) return '(no memory entries)';
                return entries.map(e => `[${e.category}] ${e.key}: ${e.value} (ttl:${e.ttl})`).join('\n');
              }
              default:
                return `ERROR: unknown action "${args.action}"`;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_memory failed — ${msg}`;
          }
        },
      }),

      agnes_todo: tool({
        description: 'Manage task checklist. Create, update, list, or delete todo items. Persists across the session.',
        args: {
          action: tool.schema.enum(['list', 'create', 'update', 'delete', 'checklist']).describe('Action to perform'),
          id: tool.schema.string().optional().describe('Todo item ID (required for update/delete)'),
          content: tool.schema.string().optional().describe('Todo item text (required for create)'),
          status: tool.schema.enum(['pending', 'in_progress', 'completed', 'blocked']).optional().describe('New status (for update)'),
          category: tool.schema.string().optional().describe('Optional category: explore, edit, verify'),
        },
        async execute(args) {
          try {
            switch (args.action) {
              case 'list': {
                const items = todoStore.list(args.status as any, args.category);
                if (items.length === 0) return '(no todos)';
                return items.map(i =>
                  `[${i.status}] ${i.id.slice(0, 8)}${i.category ? ` [${i.category}]` : ''}: ${i.content}`
                ).join('\n');
              }
              case 'create': {
                if (!args.content) return 'ERROR: content is required for create';
                const item = todoStore.create(args.content, args.category);
                return `Created todo ${item.id.slice(0, 8)}: ${item.content}`;
              }
              case 'update': {
                if (!args.id) return 'ERROR: id is required for update';
                const updated = todoStore.update(args.id, {
                  content: args.content,
                  status: args.status as any,
                  category: args.category,
                });
                if (!updated) return `ERROR: todo "${args.id}" not found`;
                return `Updated ${args.id.slice(0, 8)} → [${updated.status}] ${updated.content}`;
              }
              case 'delete': {
                if (!args.id) return 'ERROR: id is required for delete';
                todoStore.delete(args.id);
                return `Deleted todo "${args.id.slice(0, 8)}"`;
              }
              case 'checklist': {
                const items = todoStore.list();
                if (items.length === 0) return '(no todos)';
                return items.map(i =>
                  `[${i.status === 'completed' ? 'x' : ' '}] ${i.id.slice(0, 8)}: ${i.content}`
                ).join('\n');
              }
              default:
                return `ERROR: unknown action "${args.action}"`;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_todo failed — ${msg}`;
          }
        },
      }),

      agnes_status: tool({
        description: 'Show AGNES plugin status — version, tier, concurrency, loaded commands, session state, gate stats, async errors.',
        args: {
          detail: tool.schema.enum(['brief', 'full']).default('brief'),
        },
        async execute(args) {
          try {
            const status = collectStatus(getVersion(), worktreePath, memoryStore);
            if (args.detail === 'brief') {
              return [
                `AGNES v${status.version}`,
                `Tier: ${status.tier}`,
                `Concurrency: ${status.concurrency.active} active / ${status.concurrency.queued} queued (max ${status.concurrency.max})`,
                `Commands: ${status.commands.total}`,
                `Memory: ${status.memory.entries} entries`,
                `Sessions running: ${status.sessions.running}`,
                `Gate checks: ${status.gateStats.checks} (P:${status.gateStats.passed} F:${status.gateStats.failed} R:${status.gateStats.retries})`,
                `Async errors: ${status.asyncErrors.count}`,
              ].join('\n');
            }
            return JSON.stringify(status, null, 2);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_status failed — ${msg}`;
          }
        },
      }),

      agnes_reload_commands: tool({
        description: 'Force re-scan of command directories and reload command cache.',
        args: {},
        async execute() {
          try {
            forceDiscoveryRescan(worktreePath);
            const commands = discoverCommands(worktreePath);
            return `Reloaded — ${commands.length} commands found (${commands.filter(c => c.source === 'agnes').length} bundled, ${commands.filter(c => c.source === 'global').length} global, ${commands.filter(c => c.source === 'workspace').length} workspace)`;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_reload_commands failed — ${msg}`;
          }
        },
      }),

      agnes_compress: tool({
        description: 'Build or retrieve a session context summary from current state (edited files, active tasks, memory). Use force=true to regenerate.',
        args: {
          force: tool.schema.boolean().optional().default(false).describe('Force rebuild summary from current session state'),
        },
        async execute(args) {
          try {
            const existing = getSessionSummary();
            if (!args.force && existing) {
              return JSON.stringify({ compressed: true, summary: existing, regenerated: false });
            }

            const lines: string[] = [];
            if (editedFiles.size > 0) {
              lines.push(`Edited files this session: ${[...editedFiles].join(', ')}`);
            }
            if (memoryStore.entryCount > 0) {
              lines.push(`Memory: ${memoryStore.entryCount} entries`);
            }
            const todos = todoStore.list();
            const activeTodos = todos.filter(t => t.status !== 'completed');
            if (activeTodos.length > 0) {
              lines.push(`Active tasks: ${activeTodos.map(t => `${t.id.slice(0, 8)}: ${t.content}`).join(' | ')}`);
            }
            const summary = lines.length > 0
              ? lines.join('\n')
              : '(no session state to summarize)';

            setSessionSummary(summary);
            return JSON.stringify({ compressed: true, summary, regenerated: true });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `ERROR: agnes_compress failed — ${msg}`;
          }
        },
      }),
    },

    'tool.definition': async ({ toolID }, output) => {
      try {
        if (toolID === 'delegate_task') {
          output.description = 'DEPRECATED — Use agnes_delegate instead. This tool may return inconsistent task IDs and is not recommended.';
        } else if (toolID === 'get_task_result') {
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

    'tool.execute.before': async (
      hookInput: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ) => {
      await handleAutoDelegateBefore(input.client, worktreePath, hookInput, output);
    },

    'tool.execute.after': async (
      hookInput: { tool: string; sessionID: string; callID: string; args?: Record<string, unknown> },
      output: { title: string; output: string; metadata: Record<string, unknown> },
    ) => {
      await handleAutoDelegateAfter({ ...hookInput, args: hookInput.args ?? {} }, output);

      if (output.metadata?.agnesAutoDelegated) {
        extractLessons(output.output, memoryStore);
      }

      const filePath = hookInput.args?.filePath as string | undefined;
      if ((hookInput.tool === 'edit' || hookInput.tool === 'write') && filePath) {
        editedFiles.add(filePath);
      }
    },

    event: async ({ event }: { event: { type: string; path?: string } }) => {
      try {
        if (event.type === 'file.edited' && event.path) {
          editedFiles.add(event.path);
        }
      } catch (err) {
        logger.warn('Failed to handle event ' + event.type, err);
      }
    },

    'experimental.session.compacting': async (_input: unknown, output: { context?: string[]; prompt?: string }) => {
      try {
        output.context = output.context ?? [];
        const version = getVersion();
        const stable = getStableTier(version);
        const context = getContextTier(version, undefined, detectModelTier() !== 'large');
        const parts: string[] = [];
        if (stable) parts.push(stable);
        if (context) parts.push(context);
        if (parts.length > 0) {
          output.context.push(`\n\n${parts.join('\n\n---\n\n')}\n\n`);
        }
        const memoryBlock = memoryStore.formatForPrompt();
        if (memoryBlock) {
          output.context.push(`\n\n${memoryBlock}\n\n`);
        }
        const todoBlock = todoStore.formatForPrompt();
        if (todoBlock) {
          output.context.push(`\n\n${todoBlock}\n\n`);
        }
        const sessionSummary = getSessionSummary();
        if (sessionSummary) {
          output.context.push(`\n\n**[Session Summary]**\n${sessionSummary}\n\n`);
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
        _bootstrapInjectedSessions.clear();
        resetDepthTracking();
        memoryStore.prune();
        memoryStore.save();
        todoStore.save();
        gcPlans(worktreePath);
        cleanupTmpFiles(worktreePath);
      } catch (err) {
        logger.warn('Failed to clean up session state', err);
      }
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      if (!output.messages?.length) return;

      const firstUser = output.messages.find((m) => m.info?.role === 'user');
      if (!firstUser?.parts?.length) return;

      // Skip if already has AGNES bootstrap
      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('[AGNES v'))) return;
      if (firstUser.parts.some((p) => p.type === 'agent')) return;

      const sessionID = (firstUser.parts[0] as { sessionID?: string })?.sessionID ?? '';

      // Skip if this session already got bootstrap injected
      if (sessionID && _bootstrapInjectedSessions.has(sessionID)) return;

      // Detect subagent sessions by prompt pattern — prevent bootstrap injection into children
      const firstText = firstUser.parts
        .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
        .map((p: any) => p.text)
        .join('');
      const subagentPatterns = [
        'AGNES general subagent',
        'AGNES auto-delegated implementation',
        'You are implementing ONE task in a larger plan',
      ];
      if (subagentPatterns.some((p) => firstText.includes(p))) return;

      const userText = firstText.toLowerCase();
      const yoloFlags = ['--yolo', '--auto', '/yolo', '/auto', 'yolo mode', '--yes'];
      const yolo = yoloFlags.some((flag) => userText.includes(flag));
      setYoloMode(yolo);

      try {
        const version = getVersion();
        const tier = detectModelTier();
        const memoryBlock = memoryStore.formatForPrompt();
        const todoBlock = todoStore.formatForPrompt();
        const stable = getStableTier(version);
        const context = getContextTier(version, detectProject(worktreePath), tier !== 'large');
        const volatile = getVolatileTier(memoryBlock || undefined, todoBlock || undefined);
        const parts: string[] = [];
        if (stable) parts.push(stable);
        if (context) parts.push(context);
        if (volatile) parts.push(volatile);
        const bootstrap = parts.join('\n\n---\n\n');
        if (!bootstrap) return;

        let fullBootstrap = bootstrap;

        if (isYoloMode()) {
          fullBootstrap += `\n\n**⚠ YOLO MODE ACTIVATED** — Autonomous execution. Skip question gates. Max parallelization. No confirmation pauses.`;
        }

        fullBootstrap += `\n\n## Completion Protocol\nWhen all tasks are done, end your response with:\n${buildResultMessage('task-000', '<summary>')}\n\nOptionally include LESSON: <what to remember> for persistent memory.`;

        const messageID = (firstUser.parts[0] as { messageID?: string }).messageID ?? '';
        firstUser.parts.unshift({
          id: randomUUID(),
          sessionID,
          messageID,
          type: 'text',
          text: fullBootstrap,
        });

        if (sessionID) _bootstrapInjectedSessions.add(sessionID);
      } catch (err) {
        logger.warn('Failed to build bootstrap', err);
      }
    },

  };
};

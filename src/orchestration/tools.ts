import { tool } from '@opencode-ai/plugin';
import type { ToolDefinition } from '@opencode-ai/plugin';
import { DelegationManager } from './manager.js';
import { AGENTS } from './types.js';
import { getTask, getAllTasks, cleanupStaleTasks } from './session.js';
import * as logger from '../logger.js';

export function createDelegateTaskTool(manager: DelegationManager): ToolDefinition {
  return tool({
    description: `Delegate a task to a subagent for parallel execution.

Use this to fire subagents in parallel. Each subagent works on an isolated chunk (one file per subagent).
Available agents: ${Object.keys(AGENTS).join(', ')}.

background=false (default): Blocks until the subagent completes. Returns result inline.
background=true: Returns immediately with a task ID. Use get_task_result to collect later.

Use background=true when firing MULTIPLE subagents in parallel, then collect with get_task_result.
Supports \$RESULT[name] — set resultName to store the output for later reference.
Depth guard: subagents cannot delegate deeper than 3 levels. Terminal agents (build, general, explore) cannot delegate beyond depth 2.
Use groupID to group related tasks for batched notification (all complete = noReply false; individual = noReply true).`,
    args: {
      agent: tool.schema.string().describe('Agent to delegate to'),
      description: tool.schema.string().describe('Brief task description (shown in session list)'),
      prompt: tool.schema.string().describe('Full prompt for the subagent'),
      background: tool.schema.boolean().describe('true=non-blocking (returns task ID), false=blocking (waits for result)'),
      resultName: tool.schema.string().optional().describe('Store result as $RESULT[name] for later reference'),
      depth: tool.schema.number().optional().describe('Current delegation depth (auto-incremented; 0 = root)'),
      groupID: tool.schema.string().optional().describe('Group tasks for coordinated noReply batching'),
      noReply: tool.schema.boolean().optional().describe('Suppress AI processing on completion (default: true for background, false for sync)'),
    },
    async execute(args, context) {
      const { agent, description, prompt, background, resultName, depth, groupID, noReply } = args;

      if (!agent) return 'Error: agent is required';
      if (!description) return 'Error: description is required';
      if (!prompt) return 'Error: prompt is required';

      if (!AGENTS[agent]) {
        return `Error: Unknown agent "${agent}". Available: ${Object.keys(AGENTS).join(', ')}`;
      }

      const task = await manager.launch(
        {
          agent,
          description,
          prompt,
          mode: background ? 'background' : 'sync',
          depth: depth ?? 0,
          groupID,
          noReply: noReply ?? (background ? true : false),
        },
        context.sessionID,
        context.directory,
        { storeResult: !!resultName, resultName },
      );

      if (task.status === 'error') {
        return `Error delegating to ${agent}: ${task.error}`;
      }

      if (background) {
        return `Spawned ${agent} task: \`${task.id}\`\nSession: \`${task.sessionID}\`\nDepth: ${task.depth}${task.groupID ? `\nGroup: \`${task.groupID}\`` : ''}\n\nUse get_task_result({taskId: "${task.id}"}) when the subagent finishes.`;
      }

      const elapsed = Math.round((Date.now() - task.createdAt) / 1000);
      const result = task.result ?? '(no output)';
      return `[${agent}] Task completed in ${elapsed}s (depth ${task.depth})${task.groupID ? ` [group: ${task.groupID}]` : ''}\n\n${result}`;
    },
  });
}

export function createGetTaskResultTool(): ToolDefinition {
  return tool({
    description: 'Get the result of a previously delegated (background) task. Returns the current status and output.',
    args: {
      taskId: tool.schema.string().describe('Task ID returned by delegate_task'),
    },
    async execute(args) {
      const { taskId } = args;
      if (!taskId) return 'Error: taskId is required';

      const task = getTask(taskId);
      if (!task) return `Error: Task "${taskId}" not found`;

      if (task.status === 'running' || task.status === 'pending') {
        return `⏳ Task still running (${task.agent}: ${task.description})`;
      }
      if (task.status === 'error') return `Task failed: ${task.error}`;
      if (task.status === 'timeout') return `Task timed out (${task.agent}: ${task.description})`;

      const elapsed = Math.round((Date.now() - task.createdAt) / 1000);
      return `[${task.agent}] Completed in ${elapsed}s\n\n${task.result ?? '(no output)'}`;
    },
  });
}

export function createListTasksTool(): ToolDefinition {
  return tool({
    description: 'List all delegated subagent tasks and their current status.',
    args: {},
    async execute() {
      cleanupStaleTasks();
      const all = getAllTasks();
      if (!all.length) return 'No delegated tasks. Use delegate_task to spawn subagents.';

      const lines = all.map(t => {
        const age = t.completedAt
          ? `${Math.round((Date.now() - t.completedAt) / 1000)}s ago`
          : `${Math.round((Date.now() - t.createdAt) / 1000)}s running`;
        const idShort = t.id.length > 8 ? t.id.slice(0, 8) : t.id;
        return `[${t.status}] ${idShort} ${t.agent}: ${t.description} (${age})`;
      });
      return lines.join('\n');
    },
  });
}

export function createListAgentsTool(): ToolDefinition {
  return tool({
    description: 'List all available subagents and their capabilities.',
    args: {},
    async execute() {
      const lines = Object.entries(AGENTS).map(([key, def]) => {
        const perms = [];
        if (def.canWrite) perms.push('write');
        if (def.canBash) perms.push('bash');
        return `${key} — ${def.description}\n  Permissions: ${perms.join(', ') || 'read-only'}`;
      });
      return lines.join('\n\n');
    },
  });
}

export function createCancelTaskTool(): ToolDefinition {
  return tool({
    description: 'Cancel a running delegated task.',
    args: {
      taskId: tool.schema.string().describe('Task ID to cancel'),
    },
    async execute(args) {
      const { taskId } = args;
      if (!taskId) return 'Error: taskId is required';

      const task = getTask(taskId);
      if (!task) return `Error: Task "${taskId}" not found`;
      if (task.status !== 'running' && task.status !== 'pending') {
        return `Task "${taskId}" is already ${task.status}`;
      }

      try {
        const { updateTask } = await import('./session.js');
        updateTask(taskId, { status: 'error' as const, error: 'Cancelled by user', completedAt: Date.now() });
      } catch (err) {
        logger.warn('Failed to cancel task', err);
      }

      return `Cancelled task ${taskId}`;
    },
  });
}

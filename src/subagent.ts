import { randomUUID } from 'node:crypto';
import { metrics } from './metrics.js';
import type { ResultMessage } from './protocol.js';

export interface SubagentTask {
  skill: string;
  payload: unknown;
  config?: {
    maxDepth?: number;
    currentDepth?: number;
    maxDurationMs?: number;
  };
}

export async function spawnAgent(
  task: SubagentTask,
  spawnFn: () => Promise<ResultMessage>,
): Promise<ResultMessage> {
  const depth = task.config?.currentDepth ?? 0;
  const maxDepth = task.config?.maxDepth ?? 5;

  if (depth >= maxDepth) {
    await safeIncrement('subagent_depth_rejected_total');
    return {
      type: 'result',
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      taskId: `task-${task.skill}`,
      status: 'BLOCKED',
      content: `Max depth (${maxDepth}) reached for skill: ${task.skill}`,
    };
  }

  await safeIncrement('subagent_spawn_total');
  await safeIncrement('subagent_depth_attempted_total');
  await safeIncrement('subagent_depth_active');

  try {
    const result = await spawnFn();

    if (result.status === 'DONE' || result.status === 'DONE_WITH_CONCERNS') {
      await safeIncrement('subagent_success_total');
    } else if (statusIsTimedOut(result)) {
      await safeIncrement('subagent_timeout_total');
    }

    return result;
  } catch (err) {
    await safeIncrement('subagent_error_total');
    return {
      type: 'result',
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      taskId: `task-${task.skill}`,
      status: 'BLOCKED',
      content: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await safeIncrement('subagent_depth_active', -1);
  }
}

async function safeIncrement(key: string, delta?: number): Promise<void> {
  try {
    if (delta !== undefined) {
      await metrics.increment(key, delta);
    } else {
      await metrics.increment(key);
    }
  } catch {
    // Swallow metric errors — must never break subagent dispatch
  }
}

function statusIsTimedOut(result: ResultMessage): boolean {
  return result.status === 'BLOCKED' && (
    result.content.includes('timeout') ||
    result.content.includes('timed out') ||
    result.content.includes('TIMEOUT')
  );
}

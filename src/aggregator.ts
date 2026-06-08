import type { TaskItem } from './planner.js';
import { getSubagentResult } from './delegate.js';

type MinimalClient = any;

const POLL_INTERVAL_MS = 800;
const WAVE_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function aggregateWave(
  client: MinimalClient,
  tasks: TaskItem[],
  _directory: string,
): Promise<TaskItem[]> {
  const running = new Map<string, TaskItem>();
  for (const t of tasks) {
    if (t.sessionID && t.status === 'running') {
      running.set(t.sessionID, t);
    }
  }

  if (running.size === 0) return tasks;

  const start = Date.now();

  while (running.size > 0) {
    if (Date.now() - start > WAVE_TIMEOUT_MS) {
      for (const [, task] of running) {
        task.status = 'failed';
        task.error = `TIMEOUT after ${WAVE_TIMEOUT_MS / 1000}s`;
      }
      break;
    }

    await sleep(POLL_INTERVAL_MS);

    const sessionIDs = [...running.keys()];
    const results = await Promise.allSettled(
      sessionIDs.map(sid => getSubagentResult(client, sid, _directory)),
    );

    for (let i = 0; i < sessionIDs.length; i++) {
      const sid = sessionIDs[i];
      const task = running.get(sid)!;
      const r = results[i];

      if (r.status === 'rejected') {
        task.status = 'failed';
        task.error = r.reason instanceof Error ? r.reason.message : String(r.reason);
        running.delete(sid);
        continue;
      }

      const sub = r.value;
      if (sub.status === 'completed') {
        task.result = sub.output;
        task.status = 'completed';
        running.delete(sid);
      } else if (sub.status === 'error') {
        task.error = sub.error;
        task.status = 'failed';
        running.delete(sid);
      }
    }
  }

  return tasks;
}

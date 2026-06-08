import type { ModelTier } from './runtime.js';
import { detectModelTier, getSemaphore, getAsyncErrors } from './runtime.js';
import { getGateStats } from './verification.js';
import { getRunningTaskCount } from './delegate.js';
import { discoverCommands } from './discovery.js';
import type { MemoryStore } from './memory.js';

export interface AgnesStatus {
  version: string;
  tier: ModelTier;
  concurrency: { max: number; active: number; queued: number };
  commands: { total: number };
  sessions: { totalTaskRefs: number; running: number };
  memory: { entries: number; categories: Record<string, number> };
  gateStats: { checks: number; passed: number; failed: number; retries: number; lastFailure?: string };
  asyncErrors: { count: number; recent: Array<{ timestamp: string; sessionId: string; error: string }> };
}

export function collectStatus(
  version: string,
  worktreePath: string,
  memory: MemoryStore,
): AgnesStatus {
  const tier = detectModelTier();
  const sem = getSemaphore();
  const asyncErrors = getAsyncErrors();
  const gateStats = getGateStats();
  const commands = discoverCommands(worktreePath);

  const catMap: Record<string, number> = {};
  for (const e of memory.list()) {
    catMap[e.category] = (catMap[e.category] ?? 0) + 1;
  }

  return {
    version,
    tier,
    concurrency: { max: 3, active: sem.active, queued: sem.queued },
    commands: { total: commands.length },
    sessions: { totalTaskRefs: 0, running: getRunningTaskCount() },
    memory: { entries: memory.entryCount, categories: catMap },
    gateStats: {
      checks: gateStats.checksPerformed,
      passed: gateStats.checksPassed,
      failed: gateStats.checksFailed,
      retries: gateStats.retriesPerformed,
      lastFailure: gateStats.lastFailureAt,
    },
    asyncErrors: {
      count: asyncErrors.length,
      recent: asyncErrors.slice(-3).map(e => ({
        timestamp: e.timestamp,
        sessionId: e.sessionId,
        error: e.error,
      })),
    },
  };
}

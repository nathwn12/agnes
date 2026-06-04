#!/usr/bin/env bun
import * as fs from 'node:fs';
import * as path from 'node:path';

function readInstalledVersion(): string {
  try {
    const scriptDir = path.dirname(path.resolve(process.argv[1] ?? ''));
    const pkgPath = path.join(scriptDir, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dirFlag = args.indexOf('--dir');
  const dirValue = dirFlag >= 0 ? args[dirFlag + 1] : undefined;
  const projectDir = dirValue && !dirValue.startsWith('--') ? path.resolve(dirValue) : process.cwd();
  return { projectDir };
}

function findAgnesRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, '.agnes', 'index.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

interface PlanIndex {
  agnesVersion: string;
  schemaVersion: number;
  projectDir: string;
  projectName: string;
  updatedAt: string;
  activePlanId: string | null;
  plans: PlanEntry[];
}

interface PlanEntry {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  total: number;
  completed: number;
  blocked: number;
  file: string;
  attempts?: number;
  struggle?: {
    noProgressIterations: number;
    shortIterations: number;
  };
}

function readPlanIndex(root: string): PlanIndex | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.agnes', 'index.json'), 'utf-8'));
  } catch {
    return null;
  }
}

function safeAgeDays(now: number, dateStr: string): number | null {
  const time = new Date(dateStr).getTime();
  return isNaN(time) ? null : Math.round((now - time) / 86400000);
}

function main() {
  const { projectDir } = parseArgs();
  const root = findAgnesRoot(projectDir);

  if (!root) {
    console.log(JSON.stringify({
      status: 'no_agnes_state',
      message: `No .agnes/ state found at or above: ${projectDir}`,
    }, null, 2));
    process.exit(0);
  }

  const index = readPlanIndex(root);
  if (!index) {
    console.log(JSON.stringify({
      status: 'corrupt_state',
      message: `Found .agnes/ but index.json is missing or invalid at: ${root}`,
    }, null, 2));
    process.exit(0);
  }

  const { plans } = index;
  const total = plans.length;

  if (total === 0) {
    console.log(JSON.stringify({
      status: 'empty',
      projectRoot: root,
      projectName: index.projectName,
    agnesVersion: index.agnesVersion,
    installedVersion: readInstalledVersion(),
      activePlanId: index.activePlanId,
      planCount: 0,
      message: 'No plans yet. Run `bun run scripts/init-agnes.ts --dir <project>` to create the first one.',
    }, null, 2));
    process.exit(0);
  }

  // Status breakdown
  const byStatus: Record<string, number> = {};
  for (const p of plans) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  }

  // Completion stats
  const totalTasks = plans.reduce((s, p) => s + p.total, 0);
  const totalDone = plans.reduce((s, p) => s + p.completed, 0);
  const totalBlocked = plans.reduce((s, p) => s + p.blocked, 0);
  const rawRate = totalTasks > 0 && !isNaN(totalTasks) ? Math.round((totalDone / totalTasks) * 100) : 0;
  const completionRate = Math.min(100, Math.max(0, rawRate));
  const pending = Math.max(0, totalTasks - totalDone - totalBlocked);

  // Plans with struggle
  const struggledPlans = plans.filter(p => {
    const s = p.struggle;
    return s && (s.noProgressIterations > 0 || s.shortIterations > 0 || (p.attempts ?? 0) > 1);
  });

  // Age analysis
  const now = Date.now();
  const planAges = plans.map(p => ({
    id: p.id,
    status: p.status,
    ageDays: safeAgeDays(now, p.createdAt),
    summary: p.summary,
  }));
  planAges.sort((a, b) => {
    if (a.ageDays === null && b.ageDays === null) return 0;
    if (a.ageDays === null) return 1;
    if (b.ageDays === null) return -1;
    return b.ageDays - a.ageDays;
  });

  const activePlans = plans.filter(p => ['draft', 'reviewed', 'ready', 'approved', 'in_progress', 'blocked'].includes(p.status));
  const activeCount = activePlans.length;
  const oldestActive = activePlans.length > 0
    ? activePlans.reduce((a, b) => new Date(a.createdAt) < new Date(b.createdAt) ? a : b)
    : null;

  // Drift detection: plans updated but never completed or with 0 tasks done
  const driftedPlans = plans.filter(p => p.status === 'in_progress' && p.completed === 0 && p.total > 0);

  const output = {
    status: 'ok',
    projectRoot: root,
    projectName: index.projectName,
    agnesVersion: index.agnesVersion,
    installedVersion: readInstalledVersion(),
    activePlanId: index.activePlanId,
    indexedAt: index.updatedAt,
    planCount: total,
    taskCount: totalTasks,
    taskCompletion: { done: totalDone, blocked: totalBlocked, pending, ratePct: completionRate },
    byStatus,
    activePlanCount: activeCount,
    oldestActivePlan: oldestActive ? {
      id: oldestActive.id,
      summary: oldestActive.summary,
      ageDays: safeAgeDays(now, oldestActive.createdAt),
      status: oldestActive.status,
    } : null,
    recentlyCompleted: plans.filter(p => p.status === 'done')
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime();
        const bTime = new Date(b.updatedAt).getTime();
        if (isNaN(aTime) && isNaN(bTime)) return 0;
        if (isNaN(aTime)) return 1;
        if (isNaN(bTime)) return -1;
        return bTime - aTime;
      })
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        summary: p.summary,
        completedAt: p.updatedAt,
        completionRate: p.total > 0 ? Math.min(100, Math.round((p.completed / p.total) * 100)) : 0,
      })),
    struggledPlans: struggledPlans.length,
    driftedPlans: driftedPlans.map(p => ({ id: p.id, summary: p.summary })),
    planAges: planAges.slice(0, 10),
  };

  console.log(JSON.stringify(output, null, 2));
}

main();

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const OPENCODE_CACHE_ROOT = path.join(os.homedir(), '.cache', 'opencode', 'packages');

function isBlockedPath(dir: string): boolean {
  const resolved = path.resolve(dir);
  const root = path.resolve(OPENCODE_CACHE_ROOT);
  if (os.platform() === 'win32') {
    return resolved.toLowerCase().startsWith(root.toLowerCase());
  }
  return resolved.startsWith(root);
}

export type PlanStatus =
  | "draft"
  | "in_progress"
  | "blocked"
  | "done"
  | "abandoned";

export interface PlanIndexEntry {
  id: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  parent?: string;
  summary: string;
  total: number;
  completed: number;
  blocked: number;
  file: string;
}

export interface PlanIndex {
  agnesVersion: string;
  schemaVersion: 2;
  projectDir: string;
  projectName: string;
  updatedAt: string;
  activePlanId: string | null;
  plans: PlanIndexEntry[];
}

export interface ActivePlan {
  entry: PlanIndexEntry;
  content: string;
}

export function findProjectRoot(startDir?: string): string | null {
  let dir = startDir ? path.resolve(startDir) : process.cwd();
  for (let i = 0; i < 20; i++) {
    if (isBlockedPath(dir)) return null;
    if (fs.existsSync(path.join(dir, '.cache', 'agnes', 'index.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

export function cacheDir(projectRoot?: string): string | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;
  return path.join(root, '.cache', 'agnes');
}

export function readPlanIndex(projectRoot?: string): PlanIndex | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;
  const indexPath = path.join(root, '.cache', 'agnes', 'index.json');
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    return JSON.parse(raw) as PlanIndex;
  } catch {
    return null;
  }
}

export function writePlanIndex(index: PlanIndex, projectRoot?: string): void {
  const root = projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot write plan index: no project root found');
  const dir = path.join(root, '.cache', 'agnes');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'index.json');
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

export function getLatestActivePlan(projectRoot?: string): ActivePlan | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;
  const index = readPlanIndex(root);
  if (!index) return null;

  const activeStatuses: PlanStatus[] = ['draft', 'in_progress', 'blocked'];

  let target: PlanIndexEntry | undefined;

  if (index.activePlanId) {
    const entry = index.plans.find(p => p.id === index.activePlanId);
    if (entry && activeStatuses.includes(entry.status)) {
      target = entry;
    }
  }

  if (!target) {
    const sorted = [...index.plans]
      .filter(p => activeStatuses.includes(p.status))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    target = sorted[0];
  }

  if (!target) return null;

  const planPath = path.join(root, '.cache', 'agnes', target.file);
  try {
    const content = fs.readFileSync(planPath, 'utf8');
    return { entry: target, content };
  } catch {
    return null;
  }
}

export function buildPlanSummary(projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return 'No active plan. Create one before delegating work.';

  const index = readPlanIndex(root);
  if (!index || index.plans.length === 0) return 'No active plan. Create one before delegating work.';

  const active = getLatestActivePlan(root);
  if (!active) return 'No active plan. Create one before delegating work.';

  const { entry } = active;

  const goalMatch = active.content.match(/^Goal:\s*(.+)$/m);
  const goal = goalMatch ? goalMatch[1] : '';

  return `Active Plan: ${entry.id} (${entry.status}) \u2014 ${entry.completed}/${entry.total} tasks done\nGoal: ${goal}\nLatest update: ${entry.updatedAt}`;
}

export function getNextPlanId(projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return 'plan-001';

  const cache = path.join(root, '.cache', 'agnes');
  if (!fs.existsSync(cache)) return 'plan-001';

  let max = 0;
  try {
    const files = fs.readdirSync(cache);
    for (const f of files) {
      const match = f.match(/^plan-(\d+)\.md$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
  } catch {
    // fall through
  }

  return `plan-${String(max + 1).padStart(3, '0')}`;
}

function writePlanFile(root: string, id: string, content: string): string {
  const file = `${id}.md`;
  const filePath = path.join(root, '.cache', 'agnes', file);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
  return file;
}

export function createPlan(input: {
  summary: string;
  goal: string;
  check: string;
  tasks: string[];
  parent?: string;
  status?: PlanStatus;
  notes?: string[];
  projectRoot?: string;
}): ActivePlan {
  const root = input.projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot create plan: no project root found');

  const now = new Date().toISOString();
  const id = getNextPlanId(root);
  const status = input.status ?? 'draft';
  const total = input.tasks.length;
  const completed = 0;
  const blocked = 0;

  const tasksMd = input.tasks.map(t => {
    if (/^- \[[ x\/]\]/.test(t)) return t;
    return `- [ ] ${t.replace(/^- /, '')}`;
  }).join('\n');

  let content = `---
id: ${id}
status: ${status}
createdAt: ${now}
updatedAt: ${now}
${input.parent ? `parent: ${input.parent}\n` : ''}total: ${total}
completed: ${completed}
blocked: ${blocked}
---

Goal: ${input.goal}

Check: ${input.check}

Tasks:
${tasksMd}

${input.notes && input.notes.length > 0 ? `Notes:\n${input.notes.map(n => `- ${n}`).join('\n')}\n\n` : ''}Next:
- <first executable action>
`;

  const file = writePlanFile(root, id, content);

  const entry: PlanIndexEntry = {
    id,
    status,
    createdAt: now,
    updatedAt: now,
    parent: input.parent,
    summary: input.summary,
    total,
    completed,
    blocked,
    file,
  };

  const index = readPlanIndex(root) ?? {
    agnesVersion: '0.4.4',
    schemaVersion: 2 as const,
    projectDir: root,
    projectName: path.basename(root),
    updatedAt: now,
    activePlanId: null,
    plans: [],
  };

  index.plans.push(entry);
  index.updatedAt = now;
  const isActive = status === 'draft' || status === 'in_progress' || status === 'blocked';
  index.activePlanId = isActive ? id : null;
  writePlanIndex(index, root);

  return { entry, content };
}

export function createPlanIteration(input: {
  parent: string;
  summary: string;
  goal: string;
  check: string;
  tasksMarkdown: string;
  status: PlanStatus;
  completed: number;
  blocked: number;
  notes?: string[];
  projectRoot?: string;
}): ActivePlan {
  const root = input.projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot create plan iteration: no project root found');

  const now = new Date().toISOString();
  const id = getNextPlanId(root);
  const total = (input.tasksMarkdown.match(/^- \[.?\]/gm) || []).length;

  let content = `---
id: ${id}
status: ${input.status}
createdAt: ${now}
updatedAt: ${now}
parent: ${input.parent}
total: ${total}
completed: ${input.completed}
blocked: ${input.blocked}
---

Goal: ${input.goal}

Check: ${input.check}

Tasks:
${input.tasksMarkdown}

${input.notes && input.notes.length > 0 ? `Notes:\n${input.notes.map(n => `- ${n}`).join('\n')}\n\n` : ''}Next:
- <first executable action>
`;

  const file = writePlanFile(root, id, content);

  const entry: PlanIndexEntry = {
    id,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    parent: input.parent,
    summary: input.summary,
    total,
    completed: input.completed,
    blocked: input.blocked,
    file,
  };

  const index = readPlanIndex(root);
  if (!index) throw new Error('Cannot create plan iteration: no index found');

  const parentEntry = index.plans.find(p => p.id === input.parent);
  if (parentEntry && !['done', 'abandoned'].includes(parentEntry.status)) {
    parentEntry.status = 'abandoned';
    parentEntry.updatedAt = now;
  }

  index.plans.push(entry);
  index.updatedAt = now;

  if (input.status === 'done' || input.status === 'abandoned') {
    index.activePlanId = null;
  } else {
    index.activePlanId = id;
  }
  writePlanIndex(index, root);

  return { entry, content };
}

export function updatePlanStatus(input: {
  id: string;
  status: PlanStatus;
  completed?: number;
  blocked?: number;
  projectRoot?: string;
}): PlanIndexEntry | null {
  const root = input.projectRoot ?? findProjectRoot();
  if (!root) return null;

  const index = readPlanIndex(root);
  if (!index) return null;

  const entry = index.plans.find(p => p.id === input.id);
  if (!entry) return null;

  const now = new Date().toISOString();
  entry.status = input.status;
  entry.updatedAt = now;
  if (input.completed !== undefined) entry.completed = input.completed;
  if (input.blocked !== undefined) entry.blocked = input.blocked;

  index.updatedAt = now;

  if (input.status === 'done' || input.status === 'abandoned') {
    if (index.activePlanId === input.id) index.activePlanId = null;
  }

  if (input.status === 'draft' || input.status === 'in_progress' || input.status === 'blocked') {
    index.activePlanId = input.id;
  }

  writePlanIndex(index, root);

  return entry;
}

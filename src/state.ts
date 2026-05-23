import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import { PlanSchema } from './schema.js';
import type { Plan, PlanTask } from './schema.js';

import { parseAgnesMessage } from './protocol.js';
import type { CompletionStatus } from './protocol.js';

function assertShape<T>(data: unknown, shape: Record<string, string>): data is T {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  for (const [field, expectedType] of Object.entries(shape)) {
    if (typeof obj[field] !== expectedType) return false;
  }
  return true;
}

const OPENCODE_CACHE_ROOT = path.join(os.homedir(), '.cache', 'opencode', 'packages');
const AGNES_DIR = '.agnes';
const PLANS_DIR = 'plans';
const DEFAULT_MAX_PLAN_TASKS = 10;

let _agnesVersion: string | null = null;

export function getAgnesVersion(): string {
  if (_agnesVersion) return _agnesVersion;
  let version: string;
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    version = pkg.version ?? '0.0.0';
  } catch {
    version = '0.0.0';
  }
  _agnesVersion = version;
  return _agnesVersion;
}

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
  | "reviewed"
  | "ready"
  | "in_progress"
  | "blocked"
  | "done"
  | "abandoned";

export interface StruggleMetrics {
  noProgressIterations: number;
  repeatedErrors: Record<string, number>;
  shortIterations: number;
  lastPromiseTag: string | null;
  shellType?: string;
}

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
  attempts?: number;
  struggle?: StruggleMetrics;
}

export interface RetentionPolicy {
  maxAgeDays: number;
  terminalStatuses: ('done' | 'abandoned')[];
}

export interface PlanIndex {
  agnesVersion: string;
  schemaVersion: 2;
  projectDir: string;
  projectName: string;
  updatedAt: string;
  activePlanId: string | null;
  plans: PlanIndexEntry[];
  retention?: RetentionPolicy;
}

function getPlanFilePath(root: string, entry: PlanIndexEntry): string {
  const filename = entry.file || `${entry.id}.md`;
  return path.join(root, AGNES_DIR, PLANS_DIR, filename);
}

export interface ActivePlan {
  entry: PlanIndexEntry;
  content: string;
  plan?: Plan;
}

let _cachedProjectRoot: string | null = null;

export function resetProjectRootCache(): void {
  _cachedProjectRoot = null;
}

export function findProjectRoot(startDir?: string): string | null {
  if (_cachedProjectRoot && !startDir) {
    const indexPath = path.join(_cachedProjectRoot, AGNES_DIR, 'index.json');
    if (fs.existsSync(indexPath)) {
      return _cachedProjectRoot;
    }
    _cachedProjectRoot = null;
  }

  let dir = startDir ? path.resolve(startDir) : process.cwd();
  let found: string | null = null;
  for (let i = 0; i < 20; i++) {
    if (isBlockedPath(dir)) break;
    if (dir === os.homedir()) break;
    if (fs.existsSync(path.join(dir, AGNES_DIR, 'index.json'))) {
      found = dir;
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (!startDir && found) {
    _cachedProjectRoot = found;
  }
  return found;
}

export function cacheDir(projectRoot?: string): string | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;
  return path.join(root, AGNES_DIR);
}

const ENTRY_REQUIRED_SHAPE: Record<string, string> = {
  id: 'string',
  status: 'string',
  createdAt: 'string',
  updatedAt: 'string',
  summary: 'string',
  total: 'number',
  completed: 'number',
  blocked: 'number',
} as const;

const INDEX_REQUIRED_SHAPE = {
  agnesVersion: 'string',
  schemaVersion: 'number',
  projectDir: 'string',
  projectName: 'string',
  updatedAt: 'string',
  plans: 'object',
} as const;

function validatePlanIndex(raw: unknown): raw is PlanIndex {
  if (!raw || typeof raw !== 'object') return false;
  const idx = raw as Record<string, unknown>;
  if (!assertShape(idx, INDEX_REQUIRED_SHAPE)) return false;
  if (idx.schemaVersion !== 2) return false;
  if (idx.activePlanId !== null && typeof idx.activePlanId !== 'string') return false;
  if (!Array.isArray(idx.plans)) return false;

  for (const entry of idx.plans) {
    if (!assertShape(entry, ENTRY_REQUIRED_SHAPE)) return false;
  }

  return true;
}

function migratePlanEntry(entry: PlanIndexEntry): boolean {
  let changed = false;
  if (!entry.file) {
    entry.file = `${entry.id}.md`;
    changed = true;
  }
  if (typeof entry.attempts !== 'number') {
    entry.attempts = 0;
    changed = true;
  }
  if (!entry.struggle) {
    entry.struggle = freshStruggleMetrics();
    changed = true;
  }
  return changed;
}

export function readPlanIndex(projectRoot?: string): PlanIndex | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;
  const indexPath = path.join(root, AGNES_DIR, 'index.json');
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!validatePlanIndex(parsed)) return null;

    let migrated = false;
    for (const entry of parsed.plans) {
      if (migratePlanEntry(entry)) migrated = true;
    }
    if (migrated) writePlanIndex(parsed, root);

    pruneExpiredPlans(parsed, root);
    return parsed;
  } catch {
    return null;
  }
}

export function writePlanIndex(index: PlanIndex, projectRoot?: string): void {
  const root = projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot write plan index: no project root found');
  const dir = path.join(root, AGNES_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'index.json');
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

export function writePlanFile(plan: Plan, plansDir: string): string {
  const parsed = PlanSchema.parse(plan);
  const filePath = path.join(plansDir, `${parsed.id}.yaml`);
  const yaml = yamlStringify(JSON.parse(JSON.stringify(parsed)), null, { indent: 2 });
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, yaml, 'utf-8');
  fs.renameSync(tmpPath, filePath);
  return filePath;
}

export function readPlanFile(plansDir: string, planId: string): Plan | null {
  const yamlPath = path.join(plansDir, `${planId}.yaml`);
  if (fs.existsSync(yamlPath)) {
    const raw = fs.readFileSync(yamlPath, 'utf-8');
    return PlanSchema.parse(yamlParse(raw));
  }
  const mdPath = path.join(plansDir, `${planId}.md`);
  if (fs.existsSync(mdPath)) {
    return parseLegacyMdPlan(mdPath);
  }
  return null;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export function parseLegacyMdPlan(filePath: string): Plan {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const fm = raw.match(FRONTMATTER_RE);
  let frontmatter: Record<string, unknown> = {};
  let body = raw;
  if (fm) {
    frontmatter = yamlParse(fm[1]) as Record<string, unknown>;
    body = raw.slice(fm[0].length);
  }

  const goalMatch = body.match(/^Goal:\s*(.+)$/m);
  const checkMatch = body.match(/^Check:\s*(.+)$/m);
  const summaryMatch = body.match(/^#\s+\S+\s+[—–-]\s+(.+)$/m);

  const taskLines: string[] = [];
  for (const line of body.split('\n')) {
    if (/^- \[[ x\/]\]/.test(line)) {
      taskLines.push(line);
    }
  }

  const tasks: PlanTask[] = taskLines.map((t, i) => ({
    id: `task-${String(i + 1).padStart(3, '0')}`,
    summary: t.replace(/^- \[[ x\/]\]\s*/, '').trim(),
    status: t.startsWith('- [x]') ? 'done' : t.startsWith('- [/]') ? 'blocked' : 'pending',
    files: [],
    depends_on: [],
  }));

  const planId = typeof frontmatter.id === 'string' ? frontmatter.id : path.basename(filePath, '.md');
  const createdAt = typeof frontmatter.createdAt === 'string' ? frontmatter.createdAt : new Date().toISOString();
  const updatedAt = typeof frontmatter.updatedAt === 'string' ? frontmatter.updatedAt : createdAt;

  return {
    schema: 'agnes/plan-v1',
    id: planId,
    version: 1,
    createdAt,
    updatedAt,
    status: (typeof frontmatter.status === 'string' ? frontmatter.status : 'draft') as Plan['status'],
    parent: typeof frontmatter.parent === 'string' ? frontmatter.parent : null,
    goal: goalMatch ? goalMatch[1].trim() : (typeof frontmatter.goal === 'string' ? frontmatter.goal : ''),
    check: checkMatch ? checkMatch[1].trim() : (typeof frontmatter.check === 'string' ? frontmatter.check : ''),
    summary: typeof frontmatter.summary === 'string' ? frontmatter.summary : (summaryMatch ? summaryMatch[1].trim() : ''),
    tasks,
    notes: Array.isArray(frontmatter.notes) ? frontmatter.notes as string[] : [],
  };
}

const DEFAULT_RETENTION: RetentionPolicy = { maxAgeDays: 7, terminalStatuses: ['done', 'abandoned'] };

export function pruneExpiredPlans(index: PlanIndex, projectRoot?: string): PlanIndex {
  const root = projectRoot ?? findProjectRoot();
  if (!root || index.plans.length === 0) return index;

  const retention = index.retention ?? DEFAULT_RETENTION;
  const cutoffMs = Date.now() - retention.maxAgeDays * 24 * 60 * 60 * 1000;
  const terminalSet = new Set(retention.terminalStatuses);

  const kept: PlanIndexEntry[] = [];
  let changed = false;

  for (const entry of index.plans) {
    if (terminalSet.has(entry.status as 'done' | 'abandoned')) {
      const updatedMs = new Date(entry.updatedAt).getTime();
      if (!isNaN(updatedMs) && updatedMs <= cutoffMs) {
        try {
          fs.rmSync(getPlanFilePath(root, entry), { force: true });
        } catch {
          // File may already be gone
        }
        changed = true;
        continue;
      }
    }
    kept.push(entry);
  }

  if (!changed) return index;

  index.plans = kept;
  index.updatedAt = new Date().toISOString();
  if (index.activePlanId && !kept.some(p => p.id === index.activePlanId)) {
    index.activePlanId = null;
  }
  writePlanIndex(index, root);
  return index;
}

export function getLatestActivePlan(projectRoot?: string): ActivePlan | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;
  const index = readPlanIndex(root);
  if (!index) return null;

  const activeStatuses: PlanStatus[] = ['draft', 'reviewed', 'ready', 'in_progress', 'blocked'];

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
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime();
        const bTime = new Date(b.updatedAt).getTime();
        if (isNaN(aTime) && isNaN(bTime)) return b.id.localeCompare(a.id);
        if (isNaN(aTime)) return 1;
        if (isNaN(bTime)) return -1;
        const diff = bTime - aTime;
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
      });
    target = sorted[0];
  }

  if (!target) return null;

  const planPath = getPlanFilePath(root, target);
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

  let line = `Active Plan: ${entry.id} (${entry.status}) \u2014 ${entry.completed}/${entry.total} tasks done\nGoal: ${goal}\nLatest update: ${entry.updatedAt}`;

  if (entry.attempts !== undefined && entry.attempts > 0) {
    line += `\nAttempts: ${entry.attempts}`;
  }
  if (entry.struggle) {
    const s = entry.struggle;
    const parts: string[] = [];
    if (s.noProgressIterations > 0) parts.push(`no-progress:${s.noProgressIterations}`);
    if (s.shortIterations > 0) parts.push(`short-runs:${s.shortIterations}`);
    const errCount = Object.keys(s.repeatedErrors).length;
    if (errCount > 0) parts.push(`repeated-errors:${errCount}`);
    if (s.lastPromiseTag) parts.push(`last-promise:${s.lastPromiseTag}`);
    if (s.shellType) parts.push(`shell:${s.shellType}`);
    if (parts.length > 0) line += `\nStruggle: ${parts.join(', ')}`;
  }

  return line;
}

export function getNextPlanId(projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return 'plan-001';

  const cache = path.join(root, AGNES_DIR, PLANS_DIR);
  fs.mkdirSync(cache, { recursive: true });

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

function writeLegacyPlanFile(root: string, id: string, content: string): string {
  const file = `${id}.md`;
  const filePath = path.join(root, AGNES_DIR, PLANS_DIR, file);
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
  attempts?: number;
  struggle?: StruggleMetrics;
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
createdAt: ${now}
updatedAt: ${now}
${input.parent ? `parent: ${input.parent}\n` : ''}---

Goal: ${input.goal}

Check: ${input.check}

Tasks:
${tasksMd}

${input.notes && input.notes.length > 0 ? `Notes:\n${input.notes.map(n => `- ${n}`).join('\n')}\n\n` : ''}Next:
- <first executable action>
`;

  const file = writeLegacyPlanFile(root, id, content);

  const plansDir = path.join(root, AGNES_DIR, PLANS_DIR);
  const plan: Plan = {
    schema: 'agnes/plan-v1',
    id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    status: status as Plan['status'],
    parent: input.parent ?? null,
    goal: input.goal,
    check: input.check,
    summary: input.summary,
    tasks: input.tasks.map((t, i) => {
      const cleaned = t.replace(/^- \[[ x\/]\]\s*/, '').trim();
      let taskStatus: PlanTask['status'];
      if (t.startsWith('- [x]')) taskStatus = 'done';
      else if (t.startsWith('- [/]')) taskStatus = 'blocked';
      else taskStatus = 'pending';
      return {
        id: `task-${String(i + 1).padStart(3, '0')}`,
        summary: cleaned,
        status: taskStatus,
        files: [],
        depends_on: [],
      };
    }),
    notes: input.notes ?? [],
  };
  writePlanFile(plan, plansDir);

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
    ...(input.attempts !== undefined ? { attempts: input.attempts } : {}),
    ...(input.struggle !== undefined ? { struggle: input.struggle } : {}),
  };

  const index = readPlanIndex(root) ?? {
    agnesVersion: getAgnesVersion(),
    schemaVersion: 2 as const,
    projectDir: root,
    projectName: path.basename(root),
    updatedAt: now,
    activePlanId: null,
    plans: [],
  };

  index.plans.push(entry);
  index.updatedAt = now;
  const isActive = status === 'draft' || status === 'reviewed' || status === 'ready' || status === 'in_progress' || status === 'blocked';
  index.activePlanId = isActive ? id : null;
  writePlanIndex(index, root);

  return { entry, content, plan };
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
  attempts?: number;
  struggle?: StruggleMetrics;
}): ActivePlan {
  const root = input.projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot create plan iteration: no project root found');

  const now = new Date().toISOString();
  const id = getNextPlanId(root);
  const total = (input.tasksMarkdown.match(/^- \[.?\]/gm) || []).length;

  let content = `---
id: ${id}
createdAt: ${now}
updatedAt: ${now}
parent: ${input.parent}
---

Goal: ${input.goal}

Check: ${input.check}

Tasks:
${input.tasksMarkdown}

${input.notes && input.notes.length > 0 ? `Notes:\n${input.notes.map(n => `- ${n}`).join('\n')}\n\n` : ''}Next:
- <first executable action>
`;

  const file = writeLegacyPlanFile(root, id, content);

  const plansDir = path.join(root, AGNES_DIR, PLANS_DIR);
  const plan: Plan = {
    schema: 'agnes/plan-v1',
    id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    status: input.status as Plan['status'],
    parent: input.parent,
    goal: input.goal,
    check: input.check,
    summary: input.summary,
    tasks: input.tasksMarkdown.split('\n')
      .filter(line => /^- \[.?\]/.test(line))
      .map((t, i) => {
        const cleaned = t.replace(/^- \[[ x\/]\]\s*/, '').trim();
        let taskStatus: PlanTask['status'];
        if (t.startsWith('- [x]')) taskStatus = 'done';
        else if (t.startsWith('- [/]')) taskStatus = 'blocked';
        else taskStatus = 'pending';
        return {
          id: `task-${String(i + 1).padStart(3, '0')}`,
          summary: cleaned,
          status: taskStatus,
          files: [],
          depends_on: [],
        };
      }),
    notes: input.notes ?? [],
  };
  writePlanFile(plan, plansDir);

  const index = readPlanIndex(root);
  if (!index) throw new Error('Cannot create plan iteration: no index found');

  const parentEntry = index.plans.find(p => p.id === input.parent);
  const carryAttempts = input.attempts ?? parentEntry?.attempts ?? 0;
  const carryStruggle = input.struggle ?? parentEntry?.struggle;

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
    attempts: carryAttempts,
    ...(carryStruggle ? { struggle: carryStruggle } : {}),
  };
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

  return { entry, content, plan };
}

export function updatePlanStatus(input: {
  id: string;
  status: PlanStatus;
  completed?: number;
  blocked?: number;
  projectRoot?: string;
  attempts?: number;
  struggle?: StruggleMetrics;
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
  if (input.attempts !== undefined) entry.attempts = input.attempts;
  if (input.struggle !== undefined) entry.struggle = input.struggle;

  index.updatedAt = now;

  if (input.status === 'done' || input.status === 'abandoned') {
    if (index.activePlanId === input.id) index.activePlanId = null;
  }

  if (input.status === 'draft' || input.status === 'reviewed' || input.status === 'ready' || input.status === 'in_progress' || input.status === 'blocked') {
    index.activePlanId = input.id;
  }

  writePlanIndex(index, root);

  return entry;
}

const PROMISE_TAG_PATTERN = /<promise>\s*(\S+)\s*<\/promise>/i;

export function detectPromiseTag(output: string, expected?: string): boolean {
  const cleaned = output.replace(/<!--[\s\S]*?-->/g, '');
  // Check JSON protocol first
  const msg = parseAgnesMessage(cleaned);
  if (msg?.type === 'completion') return msg.status === (expected ?? 'DONE');
  // When expected is provided, also check legacy regex
  if (expected) {
    const match = cleaned.match(PROMISE_TAG_PATTERN);
    if (match) {
      return match[1] === expected;
    }
    return false;
  }
  // Fall back to legacy regex
  return PROMISE_TAG_PATTERN.test(cleaned);
}

/**
 * Extract completion status from output text.
 * Tries JSON protocol first, falls back to legacy <promise> regex.
 * @deprecated Use parseAgnesMessage for new code
 */
export function extractPromiseTag(text: string): CompletionStatus | null {
  const cleaned = text.replace(/<!--[\s\S]*?-->/g, '');
  const msg = parseAgnesMessage(cleaned);
  if (msg?.type === 'completion') return msg.status;
  if (msg?.type === 'result') return msg.status;
  // Fall back to legacy <promise> tag regex
  const match = cleaned.match(PROMISE_TAG_PATTERN);
  if (match) {
    const tag = match[1].trim();
    const statuses: CompletionStatus[] = ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED'];
    if (statuses.includes(tag as CompletionStatus)) return tag as CompletionStatus;
    return 'DONE'; // legacy: treat any non-empty match as DONE
  }
  return null;
}

export function freshStruggleMetrics(): StruggleMetrics {
  return {
    noProgressIterations: 0,
    repeatedErrors: {},
    shortIterations: 0,
    lastPromiseTag: null,
  };
}

export function updateStruggleMetrics(
  current: StruggleMetrics,
  events: {
    hadProgress: boolean;
    durationMs: number;
    errors: string[];
    promiseTag: string | null;
  },
): StruggleMetrics {
  return {
    noProgressIterations: events.hadProgress ? 0 : current.noProgressIterations + 1,
    repeatedErrors: (() => {
      if (events.errors.length === 0) return current.repeatedErrors;
      const merged = { ...current.repeatedErrors };
      for (const e of events.errors) {
        const key = e.substring(0, 100);
        merged[key] = (merged[key] || 0) + 1;
      }
      return merged;
    })(),
    shortIterations: events.durationMs < 30000 ? current.shortIterations + 1 : 0,
    lastPromiseTag: events.promiseTag ?? current.lastPromiseTag,
    shellType: current.shellType,
  };
}

export function detectStruggle(metrics: StruggleMetrics): string[] {
  const warnings: string[] = [];
  if (metrics.noProgressIterations >= 3) {
    warnings.push(`No progress in ${metrics.noProgressIterations} iterations`);
  }
  if (metrics.shortIterations >= 3) {
    warnings.push(`${metrics.shortIterations} very short iterations (<30s)`);
  }
  const repeated = Object.entries(metrics.repeatedErrors)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  for (const [error, count] of repeated) {
    warnings.push(`Same error ${count}x: "${error.substring(0, 60)}..."`);
  }
  return warnings;
}

// ─── Planning Discipline ─────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['reviewed', 'abandoned'],
  reviewed: ['ready', 'draft', 'abandoned'],
  ready: ['in_progress', 'abandoned'],
  in_progress: ['done', 'blocked', 'abandoned'],
  blocked: ['ready', 'abandoned'],
  done: [],
  abandoned: [],
};

export function validatePlanTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = VALID_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(newStatus) : false;
}

export function generatePlanTemplate(planId: string, goal: string): string {
  const shortGoal = goal.length > 64 ? goal.substring(0, 60) + '...' : goal;
  return `# ${planId} — ${shortGoal}

## Intent
<!-- What must be true after this plan executes -->

## Goal
${goal}

## Tasks
| # | Task | Dependencies | Effort | Verification |
|---|------|-------------|--------|-------------|

## Risks
<!-- What could go wrong, how to detect it early -->

## Completion Criteria
<!-- Verifiable conditions -->

## Validation
<!-- How to confirm the plan was correct after execution -->
`;
}

export interface PlanQualityReport {
  score: number;
  flags: string[];
}

const FILLER_PATTERNS = ['fix things', 'make better', 'improve stuff', 'do work', 'get things done', 'make improvements', 'tweak', 'polish', 'clean up', 'touch up', 'minor change'];

function extractSection(content: string, heading: string): string {
  const startRe = new RegExp(`^## ${heading}\\s*\\n`, 'm');
  const startMatch = content.match(startRe);
  if (!startMatch) return '';
  const startIdx = startMatch.index! + startMatch[0].length;
  const endRe = /^## /m;
  const rest = content.slice(startIdx);
  const endMatch = rest.match(endRe);
  const endIdx = endMatch ? startIdx + endMatch.index! : content.length;
  return content.slice(startIdx, endIdx).trim();
}

function parseTaskRows(content: string): { num: string; deps: string; verification: string }[] {
  const rows: { num: string; deps: string; verification: string }[] = [];
  const lines = content.split('\n');
  let inTable = false;
  let headerCount = 0;
  for (const line of lines) {
    if (/^## Tasks/.test(line)) { inTable = true; headerCount = 0; continue; }
    if (!inTable) continue;
    if (/^## /.test(line)) break;
    if (!line.startsWith('|')) continue;
    headerCount++;
    if (headerCount <= 2) continue;
    const cols = line.split('|').map(c => c.trim());
    const num = cols[1] || '';
    if (!/^\d+$/.test(num)) continue;
    rows.push({
      num,
      deps: cols[3] || '',
      verification: cols[5] || '',
    });
  }
  return rows;
}

export function assessPlanQuality(content: string): PlanQualityReport {
  const flags: string[] = [];
  let score = 0;

  const goal = extractSection(content, 'Goal');
  const criteria = extractSection(content, 'Completion Criteria');
  const risks = extractSection(content, 'Risks');
  const tasks = parseTaskRows(content);

  if (goal.length > 10) {
    score += 5;
  } else {
    flags.push('goal_too_short');
  }

  if (goal.length > 0 && !FILLER_PATTERNS.some(f => goal.toLowerCase().includes(f))) {
    score += 5;
  } else if (goal.length === 0) {
    if (!flags.includes('goal_too_short')) flags.push('goal_too_short');
  } else {
    flags.push('goal_has_filler');
  }

  if (tasks.length >= 1) {
    score += 15;
  } else {
    flags.push('no_tasks');
  }

  if (tasks.length > 0) {
    const withVerification = tasks.filter(t => t.verification.length > 2 && t.verification !== ' ');
    const prorated = Math.round(30 * withVerification.length / tasks.length);
    score += prorated;
    for (const t of tasks) {
      if (t.verification.length <= 2 || t.verification === ' ') {
        flags.push(`task_${t.num}_missing_verification`);
      }
    }
  }

  const strippedCriteria = criteria.replace(/<!--.*?-->/gs, '').trim();
  if (strippedCriteria.length > 15 && !FILLER_PATTERNS.some(f => strippedCriteria.toLowerCase().includes(f))) {
    score += 15;
  } else {
    flags.push('weak_completion_criteria');
  }

  const strippedRisks = risks.replace(/<!--.*?-->/gs, '').trim();
  if (strippedRisks.length > 0) {
    score += 10;
  } else {
    flags.push('no_risks');
  }

  if (tasks.length > 0) {
    const adj: Record<string, string[]> = {};
    for (const t of tasks) {
      adj[t.num] = t.deps.split(',').map(d => d.trim()).filter(d => /^\d+$/.test(d));
    }
    let cyclic = false;
    for (const node of Object.keys(adj)) {
      const visited = new Set<string>();
      const inStack = new Set<string>();
      function dfs(n: string): boolean {
        if (inStack.has(n)) { cyclic = true; return true; }
        if (visited.has(n)) return false;
        visited.add(n);
        inStack.add(n);
        for (const dep of (adj[n] || [])) {
          if (dfs(dep)) return true;
        }
        inStack.delete(n);
        return false;
      }
      dfs(node);
      if (cyclic) break;
    }
    if (cyclic) {
      flags.push('dependency_cycle');
    } else {
      score += 10;
    }
  }

  if (tasks.length <= DEFAULT_MAX_PLAN_TASKS) {
    score += 10;
  } else {
    flags.push('too_many_tasks');
  }

  return { score, flags };
}

export function createAutoPlan(params: { goal: string; source: 'gate' | 'user' | 'user_ready' }, projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot create auto plan: no project root found');

  const now = new Date().toISOString();
  const id = getNextPlanId(root);
  const status: PlanStatus = params.source === 'user_ready' ? 'ready' : 'draft';
  const summary = params.goal.length > 80 ? params.goal.substring(0, 80) + '...' : params.goal;

  const content = generatePlanTemplate(id, params.goal);
  writeLegacyPlanFile(root, id, content);

  const entry: PlanIndexEntry = {
    id,
    status,
    createdAt: now,
    updatedAt: now,
    summary,
    total: 0,
    completed: 0,
    blocked: 0,
    file: `${id}.md`,
  };

  const index = readPlanIndex(root) ?? {
    agnesVersion: getAgnesVersion(),
    schemaVersion: 2 as const,
    projectDir: root,
    projectName: path.basename(root),
    updatedAt: now,
    activePlanId: null,
    plans: [],
  };

  index.plans.push(entry);
  index.updatedAt = now;
  writePlanIndex(index, root);

  return id;
}

export function transitionPlanStatus(planId: string, newStatus: string, projectRoot?: string): PlanIndex | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;

  const index = readPlanIndex(root);
  if (!index) return null;

  const entry = index.plans.find(p => p.id === planId);
  if (!entry) return null;

  if (!validatePlanTransition(entry.status, newStatus)) return null;

  const transitionsRequiringQuality = new Set(['reviewed', 'ready']);
  if (transitionsRequiringQuality.has(newStatus)) {
    const planPath = getPlanFilePath(root, entry);
    let content: string;
    try {
      content = fs.readFileSync(planPath, 'utf8');
    } catch {
      return null;
    }
    const report = assessPlanQuality(content);
    if (report.score < 60) return null;
  }

  const now = new Date().toISOString();
  entry.status = newStatus as PlanStatus;
  entry.updatedAt = now;

  if (newStatus === 'in_progress') {
    index.activePlanId = planId;
  }

  if (newStatus === 'done' || newStatus === 'abandoned') {
    if (index.activePlanId === planId) {
      index.activePlanId = null;
    }
    try {
      const planPath = getPlanFilePath(root, entry);
      const existingContent = fs.readFileSync(planPath, 'utf8');
      const retro = generateRetrospective(planId, root);
      fs.writeFileSync(planPath, existingContent + '\n\n' + retro, 'utf8');
    } catch {
      // Retrospective appending is best-effort
    }
  }

  index.updatedAt = now;
  writePlanIndex(index, root);

  return index;
}

export function generateRetrospective(planId: string, projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return `## Retrospective for ${planId}\n- Error: No project root found`;

  const index = readPlanIndex(root);
  if (!index) return `## Retrospective for ${planId}\n- Error: No plan index found`;

  const entry = index.plans.find(p => p.id === planId);
  if (!entry) return `## Retrospective for ${planId}\n- Error: Plan not found`;

  const completionRate = entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 0;

  return `## Retrospective for ${planId}
- Status: ${entry.status}
- Tasks completed: ${entry.completed}/${entry.total}
- Tasks blocked: ${entry.blocked}
- Planned vs actual: ${completionRate}% completion rate
- Score: N/A
`;
}

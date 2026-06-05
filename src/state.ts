import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import { PlanSchema } from './schema.js';
import type { Plan, PlanTask, ExecutionArtifact } from './schema.js';

import * as logger from './logger.js';
import { parseAgnesMessage } from './protocol.js';
import type { CompletionStatus } from './protocol.js';

const NO_PLAN_NUDGE = 'No active plan. For simple tasks, just ask. For complex tasks, use the current planner path.';
export { NO_PLAN_NUDGE };

function parseTaskLines(lines: string[]): PlanTask[] {
  return lines.filter(l => /^[-*]\s+\[([ x/])\]/.test(l.trim())).map((line, i) => {
    const status = line.includes('[x]') ? 'done' : line.includes('[/]') ? 'in_progress' : 'pending';
    const summary = line.replace(/^[-*]\s+\[[ x/]\]\s*/, '').trim();
    return {
      id: `task-${String(i + 1).padStart(3, '0')}`,
      summary,
      status: status as PlanTask['status'],
      files: [],
      depends_on: [],
    };
  });
}

export function sortPlansByDate(plans: PlanIndexEntry[]): PlanIndexEntry[] {
  return [...plans].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    if (isNaN(aTime) && isNaN(bTime)) return b.id.localeCompare(a.id);
    if (isNaN(aTime)) return 1;
    if (isNaN(bTime)) return -1;
    const diff = bTime - aTime;
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });
}

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
const LOCK_ACQUIRE_TIMEOUT_MS = 10_000; // 10s max wait — prevents indefinite hang


let _agnesVersion: string | null = null;

function getAgnesVersion(): string {
  if (_agnesVersion) return _agnesVersion;
  let version: string;
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    version = pkg.version ?? '0.0.0';
  } catch (err) {
    logger.warn('Failed to read AGNES version', err);
    version = '0.0.0';
  }
  _agnesVersion = version;
  return _agnesVersion;
}

function acquireLockWithTimeout(lockPath: string, timeoutMs: number): number | null {
  const deadline = Date.now() + timeoutMs;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  while (Date.now() < deadline) {
    let fd: number | null = null;
    try {
      fd = fs.openSync(lockPath, 'wx');
    } catch (err) {
      if (!err || typeof err !== 'object' || (err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
    if (fd !== null) return fd;
    try {
      const lc = fs.readFileSync(lockPath, 'utf8').trim();
      const pid = parseInt(lc, 10);
      if (!Number.isNaN(pid)) {
        try { process.kill(pid, 0); } catch { }
      }
      fs.rmSync(lockPath, { force: true });
      continue;
    } catch { }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
  return null;
}

function withPlanWriteLock<T>(root: string, action: () => T): T {
  const lockPath = path.join(root, AGNES_DIR, '.write.lock');
  const lockFd = acquireLockWithTimeout(lockPath, LOCK_ACQUIRE_TIMEOUT_MS);
  if (lockFd === null) {
    throw new Error(`Failed to acquire write lock within ${LOCK_ACQUIRE_TIMEOUT_MS}ms at ${lockPath}`);
  }
  try {
    fs.writeSync(lockFd, `${process.pid}\n`);
    return action();
  } finally {
    try { fs.closeSync(lockFd); } catch { /* ignore */ }
    try { fs.rmSync(lockPath, { force: true }); } catch { /* ignore */ }
  }
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
  | "approved"
  | "in_progress"
  | "blocked"
  | "done"
  | "abandoned"
  | "pending";

const ACTIVE_STATUSES: PlanStatus[] = ['draft', 'reviewed', 'ready', 'approved', 'in_progress', 'blocked'];

export interface StruggleMetrics {
  noProgressIterations: number;
  repeatedErrors: Record<string, number>;
  shortIterations: number;
  lastPromiseTag: string | null;
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
  plannerMode?: 'builtin' | 'full';
  plannerSource?: 'auto' | 'user' | 'gate';
}

export interface PlannerRoutingContext {
  mode: 'auto' | 'builtin' | 'full';
  route: 'trivial' | 'builtin' | 'full';
  reason: string;
}

interface RetentionPolicy {
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
  const filename = entry.file || `${entry.id}.yaml`;
  return path.join(root, AGNES_DIR, PLANS_DIR, filename);
}

function getPlanMirrorPath(root: string, planId: string): string {
  return path.join(root, AGNES_DIR, PLANS_DIR, `${planId}.md`);
}

function serializePlan(plan: Plan): string {
  const parsed = PlanSchema.parse(plan);
  return yamlStringify(JSON.parse(JSON.stringify(parsed)), null, { indent: 2 });
}

function readPlanArtifact(plansDir: string, planId: string): { content: string; plan: Plan } | null {
  const yamlPath = path.join(plansDir, `${planId}.yaml`);
  if (fs.existsSync(yamlPath)) {
    try {
      const content = fs.readFileSync(yamlPath, 'utf8');
      return { content, plan: PlanSchema.parse(yamlParse(content)) };
    } catch (err) {
      logger.warn(`Failed to read or parse active plan artifact ${planId}.yaml`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  const mdPath = path.join(plansDir, `${planId}.md`);
  if (fs.existsSync(mdPath)) {
    try {
      return { content: fs.readFileSync(mdPath, 'utf8'), plan: parseLegacyMdPlan(mdPath) };
    } catch (err) {
      logger.warn(`Failed to read or parse active plan artifact ${planId}.md`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  logger.warn(`Active plan artifact not found for ${planId}`);
  return null;
}

function readPlanArtifactRaw(plansDir: string, planId: string): Record<string, unknown> | null {
  const yamlPath = path.join(plansDir, `${planId}.yaml`);
  if (fs.existsSync(yamlPath)) {
    try {
      return yamlParse(fs.readFileSync(yamlPath, 'utf8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export function appendExecutionArtifact(
  planId: string,
  artifact: ExecutionArtifact,
  projectRoot?: string,
): void {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return;
  const lockPath = path.join(root, AGNES_DIR, '.write.lock');
  const lockFd = acquireLockWithTimeout(lockPath, LOCK_ACQUIRE_TIMEOUT_MS);
  if (lockFd === null) {
    logger.error(`Failed to acquire write lock within ${LOCK_ACQUIRE_TIMEOUT_MS}ms at ${lockPath}`);
    return;
  }
  try {
    const plansDir = path.join(root, AGNES_DIR, PLANS_DIR);
    const yamlPath = path.join(plansDir, `${planId}.yaml`);
    if (!fs.existsSync(yamlPath)) return;

    const content = fs.readFileSync(yamlPath, 'utf8');
    const parsed = yamlParse(content) as Record<string, unknown>;
    const artifacts: ExecutionArtifact[] = Array.isArray(parsed.executionArtifacts)
      ? parsed.executionArtifacts as ExecutionArtifact[]
      : [];
    artifacts.push(artifact);
    parsed.executionArtifacts = artifacts;

    const yaml = yamlStringify(parsed, null, { indent: 2 });
    const tmpPath = yamlPath + '.tmp';
    fs.writeFileSync(tmpPath, yaml, 'utf-8');
    fs.renameSync(tmpPath, yamlPath);
  } catch (err) {
    logger.warn('Failed to append execution artifact', err);
  } finally {
    if (lockFd !== null) {
      try { fs.closeSync(lockFd); } catch { /* ignore */ }
      try { fs.rmSync(lockPath, { force: true }); } catch { /* ignore */ }
    }
  }
}

export function getExecutionArtifacts(
  planId: string,
  projectRoot?: string,
): ExecutionArtifact[] {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return [];
  const plansDir = path.join(root, AGNES_DIR, PLANS_DIR);
  const parsed = readPlanArtifactRaw(plansDir, planId);
  if (!parsed) return [];
  return Array.isArray(parsed.executionArtifacts)
    ? parsed.executionArtifacts as ExecutionArtifact[]
    : [];
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

function migratePlanEntry(root: string, entry: PlanIndexEntry): boolean {
  let changed = false;

  const yamlFile = `${entry.id}.yaml`;
  const mdFile = `${entry.id}.md`;
  const yamlPath = path.join(root, AGNES_DIR, PLANS_DIR, yamlFile);
  const mdPath = path.join(root, AGNES_DIR, PLANS_DIR, mdFile);

  if (!entry.file) {
    entry.file = fs.existsSync(yamlPath) ? yamlFile : fs.existsSync(mdPath) ? mdFile : yamlFile;
    changed = true;
  } else if (entry.file.endsWith('.md') && fs.existsSync(yamlPath)) {
    entry.file = yamlFile;
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
      if (migratePlanEntry(root, entry)) migrated = true;
    }
    if (migrated) writePlanIndex(parsed, root);

    pruneExpiredPlans(parsed, root);
    return parsed;
  } catch (err) {
    logger.warn('Failed to read plan index', err);
    return null;
  }
}

export function writePlanIndex(index: PlanIndex, projectRoot?: string): void {
  const root = projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot write plan index: no project root found');
  const dir = path.join(root, AGNES_DIR);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    logger.warn('Failed to create plan index directory', err);
    throw err;
  }
  const filePath = path.join(dir, 'index.json');
  const tmp = filePath + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* clean up tmp on failure */ }
    logger.warn('Failed to write plan index', err);
    throw err;
  }
}

function writePlanFile(plan: Plan, plansDir: string): string {
  const parsed = PlanSchema.parse(plan);
  const filePath = path.join(plansDir, `${parsed.id}.yaml`);
  const yaml = yamlStringify(JSON.parse(JSON.stringify(parsed)), null, { indent: 2 });
  const tmpPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, yaml, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.rmSync(tmpPath, { force: true }); } catch { /* clean up tmp on failure */ }
    logger.warn(`Failed to write plan file ${filePath}`, err);
    throw err;
  }
  return filePath;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

function parseLegacyMdPlan(filePath: string): Plan {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    raw = '';
  }
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

  const tasks: PlanTask[] = parseTaskLines(body.split('\n'));

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
        } catch (err) {
          logger.warn('Failed to prune plan file', err);
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
  return getLatestActivePlanFromIndex(root, index);
}

function getLatestActivePlanFromIndex(root: string, index: PlanIndex): ActivePlan | null {
  let target: PlanIndexEntry | undefined;

  if (index.activePlanId) {
    const entry = index.plans.find(p => p.id === index.activePlanId);
    if (entry && ACTIVE_STATUSES.includes(entry.status)) {
      target = entry;
    }
  }

  if (!target) {
    const sorted = sortPlansByDate(index.plans.filter(p => ACTIVE_STATUSES.includes(p.status)));
    target = sorted[0];
  }

  if (!target) return null;

  const artifact = readPlanArtifact(path.join(root, AGNES_DIR, PLANS_DIR), target.id);
  return artifact ? { entry: target, ...artifact } : null;
}

function formatPlannerProvenance(entry: PlanIndexEntry | null, planner?: PlannerRoutingContext): string {
  const parts: string[] = [];

  if (entry?.plannerMode) {
    parts.push(`planner:${entry.plannerMode}`);
  }
  if (entry?.plannerSource) {
    parts.push(`source:${entry.plannerSource}`);
  }
  if (planner) {
    parts.push(`route:${planner.route}`);
    parts.push(`mode:${planner.mode}`);
    parts.push(`reason:${planner.reason}`);
  }

  return parts.length > 0 ? `\nPlanner: ${parts.join(', ')}` : '';
}

export function buildPlanSummary(projectRoot?: string, planner?: PlannerRoutingContext, index?: PlanIndex | null): string {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return NO_PLAN_NUDGE + formatPlannerProvenance(null, planner);

  const resolvedIndex = index ?? readPlanIndex(root);
  if (!resolvedIndex || resolvedIndex.plans.length === 0) return NO_PLAN_NUDGE + formatPlannerProvenance(null, planner);

  const active = getLatestActivePlanFromIndex(root, resolvedIndex);
  if (!active) return NO_PLAN_NUDGE + formatPlannerProvenance(null, planner);

  const { entry } = active;

  const goal = active.plan?.goal ?? (active.content.match(/^Goal:\s*(.+)$/m)?.[1] ?? '');

  let line = `Active Plan: ${entry.id} (${entry.status}) \u2014 ${entry.completed}/${entry.total} tasks done\nGoal: ${goal}\nLatest update: ${entry.updatedAt}`;

  if (entry.attempts !== undefined && entry.attempts > 0) {
    line += `\nAttempts: ${entry.attempts}`;
  }
  if (entry.plannerMode || entry.plannerSource || planner) {
    line += formatPlannerProvenance(entry, planner);
  }
  if (entry.struggle) {
    const s = entry.struggle;
    const parts: string[] = [];
    if (s.noProgressIterations > 0) parts.push(`no-progress:${s.noProgressIterations}`);
    if (s.shortIterations > 0) parts.push(`short-runs:${s.shortIterations}`);
    const errCount = Object.keys(s.repeatedErrors).length;
    if (errCount > 0) parts.push(`repeated-errors:${errCount}`);
    if (s.lastPromiseTag) parts.push(`last-promise:${s.lastPromiseTag}`);
    if (parts.length > 0) line += `\nStruggle: ${parts.join(', ')}`;
  }

  return line;
}

export function getNextPlanId(projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return 'plan-001';

  const cache = path.join(root, AGNES_DIR, PLANS_DIR);
  try {
    fs.mkdirSync(cache, { recursive: true });
  } catch {
    return 'plan-001';
  }

  let max = 0;
  try {
    const files = fs.readdirSync(cache);
    for (const f of files) {
      const match = f.match(/^plan-(\d+)\.(?:yaml|md)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
  } catch (err) {
    logger.warn('Failed to read plan directory', err);
  }

  return `plan-${String(max + 1).padStart(3, '0')}`;
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
  plannerMode?: 'builtin' | 'full';
  plannerSource?: 'auto' | 'user' | 'gate';
}): ActivePlan {
  const root = input.projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot create plan: no project root found');

  return withPlanWriteLock(root, () => {
    const now = new Date().toISOString();
    const id = getNextPlanId(root);
    const status = input.status ?? 'draft';
    const total = input.tasks.length;
    const completed = 0;
    const blocked = 0;

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
      ...(input.plannerMode ? { plannerMode: input.plannerMode } : {}),
      ...(input.plannerSource ? { plannerSource: input.plannerSource } : {}),
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
    const content = serializePlan(plan);
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
      file: `${id}.yaml`,
      ...(input.attempts !== undefined ? { attempts: input.attempts } : {}),
      ...(input.struggle !== undefined ? { struggle: input.struggle } : {}),
      ...(input.plannerMode ? { plannerMode: input.plannerMode } : {}),
      ...(input.plannerSource ? { plannerSource: input.plannerSource } : {}),
    };

    const index: PlanIndex = readPlanIndex(root) ?? {
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
    const isActive = ACTIVE_STATUSES.includes(status);
    index.activePlanId = isActive ? id : null;
    writePlanIndex(index, root);

    return { entry, content, plan };
  });
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
  plannerMode?: 'builtin' | 'full';
  plannerSource?: 'auto' | 'user' | 'gate';
}): ActivePlan {
  const root = input.projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot create plan iteration: no project root found');

  return withPlanWriteLock(root, () => {
    const now = new Date().toISOString();
    const id = getNextPlanId(root);
    const total = (input.tasksMarkdown.match(/^- \[.?\]/gm) || []).length;

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
      ...(input.plannerMode ? { plannerMode: input.plannerMode } : {}),
      ...(input.plannerSource ? { plannerSource: input.plannerSource } : {}),
      tasks: parseTaskLines(input.tasksMarkdown.split('\n')),
      notes: input.notes ?? [],
    };
    const content = serializePlan(plan);
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
      file: `${id}.yaml`,
      attempts: carryAttempts,
      ...(carryStruggle ? { struggle: carryStruggle } : {}),
      ...(input.plannerMode ? { plannerMode: input.plannerMode } : {}),
      ...(input.plannerSource ? { plannerSource: input.plannerSource } : {}),
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
  });
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

  return withPlanWriteLock(root, () => {
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

    if (ACTIVE_STATUSES.includes(input.status)) {
      index.activePlanId = input.id;
    }

    writePlanIndex(index, root);

    return entry;
  });
}

const CANONICAL_AGNES_MESSAGE_PATTERN = /<!--\s*<agnes:message>[\s\S]*?<\/agnes:message>\s*-->/;

function parseCanonicalCompletionSignal(output: string): CompletionStatus | null {
  const envelope = output.match(CANONICAL_AGNES_MESSAGE_PATTERN)?.[0];
  if (!envelope) return null;

  const msg = parseAgnesMessage(envelope);
  if ((msg?.type === 'completion' || msg?.type === 'result') && (msg as { schema?: string }).schema === 'agnes/message-v1') {
    return msg.status;
  }
  return null;
}

export function detectPromiseTag(output: string, expected?: string): boolean {
  const status = parseCanonicalCompletionSignal(output);
  if (!status) return false;
  return status === (expected ?? 'DONE');
}

/**
 * Extract completion status from output text.
 * Requires the canonical HTML-commented AGNES message protocol.
 * @deprecated Use parseAgnesMessage for new code
 */
export function extractPromiseTag(text: string): CompletionStatus | null {
  return parseCanonicalCompletionSignal(text);
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

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['reviewed', 'abandoned'],
  reviewed: ['ready', 'approved', 'draft', 'abandoned'],
  ready: ['in_progress', 'abandoned'],
  approved: ['in_progress', 'abandoned'],
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

function parseQualityInput(content: string): { goal: string; criteria: string; risks: string; tasks: { num: string; deps: string; verification: string }[] } {
  try {
    const parsed = PlanSchema.parse(yamlParse(content));
    return {
      goal: parsed.goal,
      criteria: parsed.check,
      risks: parsed.notes.join('\n'),
      tasks: parsed.tasks.map((task, i) => ({
        num: String(i + 1),
        deps: task.depends_on.join(', '),
        verification: task.files.join(', ') || task.summary,
      })),
    };
  } catch (err) {
    logger.warn('Failed to parse plan YAML, falling back to section extraction', err);
    return {
      goal: extractSection(content, 'Goal'),
      criteria: extractSection(content, 'Completion Criteria'),
      risks: extractSection(content, 'Risks'),
      tasks: parseTaskRows(content),
    };
  }
}

export function assessPlanQuality(content: string): PlanQualityReport {
  const flags: string[] = [];
  let score = 0;

  const { goal, criteria, risks, tasks } = parseQualityInput(content);

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

export function createAutoPlan(params: { goal: string; source: 'gate' | 'user' | 'user_ready'; complexity?: 'trivial' | 'complex' }, projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot create auto plan: no project root found');

  if (params.complexity === 'trivial') {
    return '';
  }

  return withPlanWriteLock(root, () => {
    const now = new Date().toISOString();
    const id = getNextPlanId(root);
    const status: PlanStatus = params.source === 'user_ready' ? 'ready' : 'draft';
    const summary = params.goal.length > 80 ? params.goal.substring(0, 80) + '...' : params.goal;

    const plan: Plan = {
      schema: 'agnes/plan-v1',
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
      status,
      parent: null,
      goal: params.goal,
      check: 'TBD',
      summary,
      tasks: [],
      notes: [],
    };
    const plansDir = path.join(root, AGNES_DIR, PLANS_DIR);
    writePlanFile(plan, plansDir);

    const entry: PlanIndexEntry = {
      id,
      status,
      createdAt: now,
      updatedAt: now,
      summary,
      total: 0,
      completed: 0,
      blocked: 0,
      file: `${id}.yaml`,
    };

    const index: PlanIndex = readPlanIndex(root) ?? {
      agnesVersion: getAgnesVersion(),
      schemaVersion: 2 as const,
      projectDir: root,
      projectName: path.basename(root),
      updatedAt: now,
      activePlanId: null,
      plans: [],
    };

    index.activePlanId = id;
    index.plans.push(entry);
    index.updatedAt = now;
    writePlanIndex(index, root);

    return id;
  });
}

function buildBuiltinPlanTasks(goal: string): string[] {
  const trimmedGoal = goal.trim();
  const subject = trimmedGoal.length > 72 ? `${trimmedGoal.slice(0, 69)}...` : trimmedGoal;

  return [
    `Confirm the smallest scope for: ${subject}`,
    'Implement the change in the primary file or module',
    'Verify the result with a focused test or manual check',
  ];
}

function buildBuiltinPlanCheck(goal: string): string {
  const trimmedGoal = goal.trim();
  const subject = trimmedGoal.length > 72 ? `${trimmedGoal.slice(0, 69)}...` : trimmedGoal;
  return `Focused verification confirms the requested change: ${subject}`;
}

export function createBuiltinPlan(input: {
  goal: string;
  source: 'gate' | 'user' | 'user_ready';
}, projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  if (!root) throw new Error('Cannot create builtin plan: no project root found');

  const status: PlanStatus = input.source === 'user_ready' ? 'ready' : 'draft';
  const summary = input.goal.length > 80 ? `${input.goal.substring(0, 80)}...` : input.goal;

  const active = createPlan({
    summary,
    goal: input.goal,
    check: buildBuiltinPlanCheck(input.goal),
    tasks: buildBuiltinPlanTasks(input.goal),
    status,
    projectRoot: root,
    plannerMode: 'builtin',
    plannerSource: input.source === 'gate' ? 'gate' : 'user',
  });

  return active.entry.id;
}

export function transitionPlanStatus(planId: string, newStatus: string, projectRoot?: string): PlanIndex | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;

  return withPlanWriteLock(root, () => {
    const index = readPlanIndex(root);
    if (!index) return null;

    const entry = index.plans.find(p => p.id === planId);
    if (!entry) return null;

    if (!validatePlanTransition(entry.status, newStatus)) return null;

    const transitionsRequiringQuality = new Set(['reviewed', 'ready']);
    if (transitionsRequiringQuality.has(newStatus)) {
      const planPath = fs.existsSync(getPlanFilePath(root, entry))
        ? getPlanFilePath(root, entry)
        : fs.existsSync(getPlanMirrorPath(root, planId))
          ? getPlanMirrorPath(root, planId)
          : getPlanFilePath(root, entry);
      let content: string;
      try {
        content = fs.readFileSync(planPath, 'utf8');
      } catch (err) {
        logger.warn('Failed to read plan file', err);
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
    }

    index.updatedAt = now;
    writePlanIndex(index, root);

    return index;
  });
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

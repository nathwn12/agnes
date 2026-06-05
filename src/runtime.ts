import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  findProjectRoot,
  getLatestActivePlan,
  readPlanIndex,
  updatePlanStatus,
  createPlanIteration,
  createBuiltinPlan,
  extractPromiseTag,
  freshStruggleMetrics,
  updateStruggleMetrics,
  cacheDir,
  sortPlansByDate,
  appendExecutionArtifact,
} from './state.js';
import type { PlanIndexEntry, PlanIndex, ActivePlan, StruggleMetrics, PlannerRoutingContext } from './state.js';
import type { GateEvidence, RetryClassification, ExecutionArtifact } from './schema.js';
import type { CompletionStatus } from './protocol.js';
import * as logger from './logger.js';
import { runGates, gateResultToEvidence } from './verification.js';
import type { Gate, GateResult } from './verification.js';

export type JumpTarget = 'retry' | 'skip' | 'blocked' | 'next_wave' | 'end';

export interface WaveSignal {
  jumpTo: JumpTarget | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}


const RETRY_BUDGETS: Record<RetryClassification, number> = {
  retryable: 3,
  needs_context: 1,
  blocked: 0,
  terminal: 0,
  verification_failed: 2,
};

const MAX_BLOCK_CHAIN = 3;

interface ExecutionOutcome {
  attempt: number;
  completed: boolean;
  blocked?: boolean;
  retryClass?: RetryClassification;
  gateEvidence?: GateEvidence[];
  flowSignal?: { jumpTo: JumpTarget | null; reason?: string };
  promiseTag: CompletionStatus | null;
  summary: string;
  error?: string;
}

function outcomeToArtifact(outcome: ExecutionOutcome): ExecutionArtifact {
  return {
    attempt: outcome.attempt,
    completed: outcome.completed,
    summary: outcome.summary,
    timestamp: new Date().toISOString(),
    gateEvidence: outcome.gateEvidence ?? [],
    ...(outcome.retryClass ? { retryClass: outcome.retryClass } : {}),
    ...(outcome.flowSignal ? { flowSignal: outcome.flowSignal } : {}),
  };
}

interface SessionState {
  attempts: number;
  struggle: StruggleMetrics;
  lastPromiseTag: CompletionStatus | null;
  lastAccessed: number;
  /** Per-class retry attempt counters */
  retryCounts: Partial<Record<RetryClassification, number>>;
}

const sessions = new Map<string, SessionState>();
const MAX_SESSIONS = 200;
const SESSION_TTL_MS = 3600000;

loadSessions();

function pruneSessions(): void {
  const now = Date.now();
  for (const [key, state] of sessions) {
    if (now - state.lastAccessed > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
  if (sessions.size > MAX_SESSIONS) {
    const entries = [...sessions.entries()];
    const toDelete = entries.slice(0, entries.length - MAX_SESSIONS);
    for (const [key] of toDelete) {
      sessions.delete(key);
    }
  }
}

function sessionsFilePath(projectRoot?: string): string | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;
  const dir = cacheDir(root);
  return dir ? path.join(dir, 'sessions.json') : null;
}

function persistSessions(projectRoot?: string): void {
  try {
    const filePath = sessionsFilePath(projectRoot);
    if (!filePath) return;
    const tmp = filePath + '.tmp';
    const data: Record<string, SessionState> = {};
    for (const [key, state] of sessions) {
      data[key] = state;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    logger.warn('Failed to persist sessions', err);
  }
}

function loadSessions(projectRoot?: string): void {
  try {
    const filePath = sessionsFilePath(projectRoot);
    if (!filePath) return;
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as Record<string, SessionState>;
    for (const [key, state] of Object.entries(data)) {
      if (state && typeof state.attempts === 'number' && state.struggle && typeof state.lastAccessed === 'number') {
        sessions.set(key, state);
      }
    }
  } catch (err) {
    logger.warn('Failed to load sessions', err);
  }
}

function getSession(sessionId: string): SessionState {
  let s = sessions.get(sessionId);
  if (!s) {
    s = { attempts: 0, struggle: freshStruggleMetrics(), lastPromiseTag: null, lastAccessed: Date.now(), retryCounts: {} };
    sessions.set(sessionId, s);
  } else {
    s.lastAccessed = Date.now();
    sessions.delete(sessionId);
    sessions.set(sessionId, s);
  }
  return s;
}

function isRetryBudgetExhausted(retryClass: RetryClassification, counts: Partial<Record<RetryClassification, number>>): boolean {
  const maxRetries = RETRY_BUDGETS[retryClass] ?? RETRY_BUDGETS.retryable;
  const used = counts[retryClass] ?? 0;
  return used >= maxRetries;
}

export interface AgnesRuntimeState {
  hasActivePlan: boolean;
  activePlanId: string | null;
  planContent: string | null;
  planEntry: PlanIndexEntry | null;
  struggle?: StruggleMetrics;
  iteration?: number;
  maxIterations?: number;
  completionPromise?: string;
}

export function getPlanGateFromState(state: AgnesRuntimeState): string | null {
  if (!state.hasActivePlan) {
    return `\n**PLAN REQUIRED:** No active plan found. Create a plan with \`.agnes/\` before any implementation work.`;
  }
  if (state.planEntry && state.planEntry.status !== 'approved') {
    return `\n**APPROVAL REQUIRED:** ${state.planEntry.id} is ${state.planEntry.status}. Implementation requires an approved active plan.`;
  }
  return null;
}

function isLaterPlan(candidate: PlanIndexEntry, parent: PlanIndexEntry): boolean {
  const candidateTime = new Date(candidate.updatedAt).getTime();
  const parentTime = new Date(parent.updatedAt).getTime();
  if (!Number.isNaN(candidateTime) && !Number.isNaN(parentTime)) {
    return candidateTime > parentTime;
  }
  return candidate.id.localeCompare(parent.id) > 0;
}

function directChildSupersedesPlan(index: PlanIndex, parent: PlanIndexEntry): boolean {
  return index.plans.some(plan => plan.parent === parent.id && isLaterPlan(plan, parent));
}

function getExecutionApprovalBlock(index: PlanIndex): string | null {
  const activePlanId = index.activePlanId;
  if (!activePlanId) return 'No active plan found. Create a plan with `.agnes/` before any implementation work.';

  let activeEntry: PlanIndexEntry | undefined = index.plans.find(plan => plan.id === activePlanId);
  if (!activeEntry) {
    const fallback = getLatestActivePlan(index.projectDir);
    activeEntry = fallback?.entry;
  }
  if (!activeEntry) return 'No active plan found. Create a plan with `.agnes/` before any implementation work.';
  if (activeEntry.status !== 'approved') {
    return `${activeEntry.id} is ${activeEntry.status}. Implementation requires an approved active plan.`;
  }
  if (directChildSupersedesPlan(index, activeEntry)) {
    return `${activeEntry.id} was superseded by a direct child plan. Approve the current plan before implementation.`;
  }
  return null;
}

export function getPlanState(workspaceRoot?: string | null): {
  hasActivePlan: boolean;
  activePlan: ActivePlan | null;
  planIndex: PlanIndex | null;
  latestId: string | null;
} {
  if (workspaceRoot === undefined) {
    workspaceRoot = findProjectRoot();
  }
  if (!workspaceRoot) {
    return { hasActivePlan: false, activePlan: null, planIndex: null, latestId: null };
  }

  const planIndex = readPlanIndex(workspaceRoot);
  if (!planIndex) {
    return { hasActivePlan: false, activePlan: null, planIndex: null, latestId: null };
  }

  const active = getLatestActivePlan(workspaceRoot);
  const latestId = planIndex.plans.length > 0
    ? sortPlansByDate(planIndex.plans)[0].id
    : null;

  return {
    hasActivePlan: active !== null,
    activePlan: active,
    planIndex,
    latestId,
  };
}

export function getPlanGate(workspaceRoot?: string | null): string | null {
  const state = getPlanState(workspaceRoot);
  if (!state.planIndex) {
    return null;
  }
  if (!state.hasActivePlan) {
    return '';
  }
  if (state.activePlan?.entry.status === 'blocked') {
    return `\n**BLOCKED PLAN:** ${state.activePlan.entry.id} is blocked. Resolve or create a new iteration.`;
  }
  const approvalBlock = getExecutionApprovalBlock(state.planIndex);
  if (approvalBlock) {
    return `\n**APPROVAL REQUIRED:** ${approvalBlock}`;
  }
  return null;
}

export function getPlanGateFromIndex(index: PlanIndex): string | null {
  if (!index.activePlanId) {
    return '';
  }
  const active = index.plans.find(plan => plan.id === index.activePlanId) ?? null;
  if (!active) {
    return 'No active plan found. Create a plan with `.agnes/` before any implementation work.';
  }
  if (active.status === 'blocked') {
    return `\n**BLOCKED PLAN:** ${active.id} is blocked. Resolve or create a new iteration.`;
  }
  const approvalBlock = getExecutionApprovalBlock(index);
  if (approvalBlock) {
    return `\n**APPROVAL REQUIRED:** ${approvalBlock}`;
  }
  return null;
}

export function checkIterationCompletion(
  output: string,
  _promise?: string,
): { detected: boolean; tag: CompletionStatus | null } {
  const tag = extractPromiseTag(output);
  const detected = tag !== null;
  return { detected, tag };
}

export function recordAttempt(
  sessionId: string,
  promiseTag: CompletionStatus | null,
  projectRoot?: string,
  completionPromise = 'DONE',
): ExecutionOutcome {
  const state = getSession(sessionId);

  const root = projectRoot ?? findProjectRoot();
  if (root) {
    const index = readPlanIndex(root);
    if (index?.activePlanId) {
      const activeEntry = index.plans.find(p => p.id === index.activePlanId);
      if (activeEntry?.status === 'blocked') {
        state.attempts++;
        persistSessions(root);
        return {
          attempt: state.attempts,
          completed: false,
          blocked: true,
          retryClass: 'blocked',
          promiseTag: null,
          summary: 'plan is blocked',
          error: 'Active plan is in blocked status',
        };
      }
    }
  }

  const completed = promiseTag !== null && promiseTag === completionPromise;

  if (completed) {
    state.lastPromiseTag = promiseTag;
    state.attempts = 0;
    state.retryCounts = {};
    state.struggle = freshStruggleMetrics();

    // Capture planId BEFORE persistToPlan('done') clears activePlanId
    if (root) {
      const preIndex = readPlanIndex(root);
      if (preIndex?.activePlanId) {
        appendExecutionArtifact(preIndex.activePlanId, outcomeToArtifact({
          attempt: 0,
          completed: true,
          promiseTag,
          summary: 'task completed successfully',
        }), root);
      }
    }

    pruneSessions();
    persistSessions(projectRoot);
    persistToPlan('done', 0, freshStruggleMetrics(), projectRoot);
    return {
      attempt: 0,
      completed: true,
      promiseTag,
      summary: 'task completed successfully',
    };
  }

  state.attempts++;

  // Determine retry class based on context
  const retryClass: RetryClassification = (() => {
    const root2 = projectRoot ?? findProjectRoot();
    if (root2) {
      const idx = readPlanIndex(root2);
      if (idx?.activePlanId) {
        const activeEntry2 = idx.plans.find(p => p.id === idx.activePlanId);
        if (activeEntry2?.status === 'blocked') return 'blocked';
      }
    }
    return 'retryable';
  })();

  // Track per-class retry count
  state.retryCounts[retryClass] = (state.retryCounts[retryClass] ?? 0) + 1;

  // Update struggle metrics
  state.struggle = updateStruggleMetrics(state.struggle, {
    hadProgress: false,
    durationMs: 0,
    errors: [],
    promiseTag: null,
  });

  // Check retry budget
  if (isRetryBudgetExhausted(retryClass, state.retryCounts)) {
    autoBlockPlan(projectRoot, state.attempts, state.struggle);
    state.attempts = 0;
    state.retryCounts = {};
    state.struggle = freshStruggleMetrics();
    pruneSessions();
    persistSessions(projectRoot);
    if (root) {
      const index = readPlanIndex(root);
      if (index?.activePlanId) {
        appendExecutionArtifact(index.activePlanId, outcomeToArtifact({
          attempt: RETRY_BUDGETS[retryClass] ?? 3,
          completed: false,
          blocked: true,
          retryClass: 'terminal',
          promiseTag: null,
          summary: `blocked after exhausting retry budget (${retryClass})`,
        }), root);
      }
    }
    return {
      attempt: RETRY_BUDGETS[retryClass] ?? 3,
      completed: false,
      blocked: true,
      retryClass: 'terminal',
      promiseTag: null,
      summary: `blocked after exhausting retry budget (${retryClass})`,
    };
  }

  persistToPlan('in_progress', state.attempts, state.struggle, projectRoot);
  persistSessions(projectRoot);
  if (root) {
    const index = readPlanIndex(root);
    if (index?.activePlanId) {
      appendExecutionArtifact(index.activePlanId, outcomeToArtifact({
        attempt: state.attempts,
        completed: false,
        retryClass,
        promiseTag: null,
        summary: `attempt ${state.attempts} (${retryClass}) did not complete`,
      }), root);
    }
  }
  return {
    attempt: state.attempts,
    completed: false,
    retryClass,
    promiseTag: null,
    summary: `attempt ${state.attempts} (${retryClass}) did not complete`,
  };
}

function autoBlockPlan(projectRoot: string | undefined, attempts: number, struggle: StruggleMetrics): void {
  try {
    const root = projectRoot ?? findProjectRoot();
    if (!root) return;
    const active = getLatestActivePlan(root);
    if (!active) return;

    const plan = active.plan;
    const goal = plan?.goal ?? active.content.match(/^Goal:\s*(.+)$/m)?.[1] ?? 'Unknown goal';
    const check = plan?.check ?? active.content.match(/^Check:\s*(.+)$/m)?.[1] ?? 'unknown check';
    const tasksMarkdown = plan
      ? plan.tasks.map(task => {
          const status = task.status === 'done' ? 'x' : task.status === 'blocked' ? '/' : ' ';
          return `- [${status}] ${task.summary}`;
        }).join('\n') || '- [ ] Unknown'
      : (active.content.match(/Tasks:\n([\s\S]*?)(?:\n\n|$)/)?.[1]?.trim()) ?? '- [ ] Unknown';

    if (active.entry.blocked >= MAX_BLOCK_CHAIN) {
      createPlanIteration({
        parent: active.entry.id,
        summary: 'Cascade abandon: blocked chain exceeded limit',
        goal,
        check,
        tasksMarkdown,
        status: 'abandoned',
        completed: active.entry.completed,
        blocked: active.entry.blocked,
        attempts,
        struggle,
        projectRoot: root,
      });
      return;
    }

    createPlanIteration({
      parent: active.entry.id,
      summary: `Auto-blocked after ${attempts} failed attempts`,
      goal,
      check,
      tasksMarkdown,
      status: 'blocked',
      completed: active.entry.completed,
      blocked: active.entry.blocked + 1,
      attempts,
      struggle,
      projectRoot: root,
    });
  } catch (err) {
    logger.warn('Failed to auto-block plan', err);
  }
}

function persistToPlan(
  status: PlanIndexEntry['status'],
  attempts: number,
  struggle: StruggleMetrics,
  projectRoot?: string,
): void {
  try {
    const root = projectRoot ?? findProjectRoot();
    if (!root) return;
    const index = readPlanIndex(root);
    if (!index?.activePlanId) return;
    const activeEntry = index.plans.find(p => p.id === index.activePlanId);
    if (!activeEntry) return;
    if (activeEntry.status === 'blocked') return;
    updatePlanStatus({
      id: index.activePlanId,
      status,
      attempts,
      struggle,
      projectRoot: root,
    });
  } catch (err) {
    logger.warn('Failed to persist plan state', err);
  }
}

export function buildExecutionContext(entry: PlanIndexEntry): string {
  const lines: string[] = [];

  if (entry.attempts !== undefined && entry.attempts > 0) {
    lines.push(`Current attempt: ${entry.attempts + 1}`);
  }

  if (entry.struggle) {
    const s = entry.struggle;
    const warnings: string[] = [];
    if (s.noProgressIterations >= 3) warnings.push('multiple iterations without file changes');
    if (s.shortIterations >= 3) warnings.push('multiple very short iterations');
    const repeated = Object.entries(s.repeatedErrors)
      .filter(([_, c]) => c >= 2)
      .map(([err]) => `recurring error: "${err.substring(0, 60)}..."`);
    warnings.push(...repeated);
    if (warnings.length > 0) {
      lines.push('Struggle signals detected:');
      lines.push(...warnings.map(w => `  - ${w}`));
    }
    if (s.lastPromiseTag) {
      lines.push(`Last canonical completion status seen: ${s.lastPromiseTag}`);
    }
  }

  lines.push('Output <!-- <agnes:message>{"type":"completion","id":"<uuid>","timestamp":"<iso>","status":"DONE","summary":"...","schema":"agnes/message-v1"}</agnes:message> --> when the task is genuinely complete.');

  return lines.join('\n');
}

const IMPLEMENT_WORDS = new Set([
  'implement', 'build', 'add', 'fix', 'change', 'create', 'refactor',
  'write', 'edit', 'update', 'remove', 'delete', 'broken',
  'fails', 'error', 'feature', 'support', 'need', 'want', 'should',
]);

const CLARIFY_PATTERNS = ['what is', 'how does', 'explain', 'why', 'describe', 'tell me', 'show me'];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'and', 'or', 'is', 'it', 'be', 'this', 'that',
]);

export interface IntentClassification {
  category: 'implement' | 'clarify' | 'plan' | 'unknown' | 'review' | 'test' | 'debug';
  suggestedSkills: string[];
}

const INTENT_SKILL_MAP: Record<string, string[]> = {
  implement: ['general'],
  clarify: ['clarify'],
  plan: ['planner', 'prd'],
  review: ['reviewer', 'verifier'],
  test: ['tdd', 'tester'],
  debug: ['debugger', 'grill-me'],
  unknown: [],
};

export function classifyIntent(message: string): IntentClassification {
  const lower = message.toLowerCase().trim();
  if (!lower) return { category: 'unknown', suggestedSkills: [] };

  if (lower.includes('?') || CLARIFY_PATTERNS.some(p => lower.includes(p))) {
    return { category: 'clarify', suggestedSkills: INTENT_SKILL_MAP.clarify };
  }

  const tokens = lower.split(/[^a-z0-9]+/).filter(t => t.length > 0);

  const hasDebugPhrase = lower.includes("debug") || lower.includes("bug");
  const hasReviewPhrase = lower.includes("review") || lower.includes("check") || lower.includes("verify");
  const hasTestPhrase = lower.includes("test");

  const hasImplPhrase = lower.includes("doesn't work") || lower.includes("test fails");
  const hasImplToken = tokens.some(t => IMPLEMENT_WORDS.has(t));
  const hasImplementationSignal = hasImplPhrase || hasImplToken;

  const hasPlanToken = tokens.some(t => t === 'plan');
  const hasAnyWorkSignal = hasImplementationSignal || hasTestPhrase || hasDebugPhrase || hasReviewPhrase;

  if (hasPlanToken && hasAnyWorkSignal) {
    return { category: 'plan', suggestedSkills: INTENT_SKILL_MAP.plan };
  }

  if (hasDebugPhrase && !hasImplPhrase && !hasImplToken) {
    return { category: 'debug', suggestedSkills: INTENT_SKILL_MAP.debug };
  }

  if (hasReviewPhrase && !hasImplPhrase && !hasImplToken) {
    return { category: 'review', suggestedSkills: INTENT_SKILL_MAP.review };
  }

  if (hasTestPhrase && !hasImplPhrase) {
    return { category: 'test', suggestedSkills: INTENT_SKILL_MAP.test };
  }

  if (hasImplementationSignal) {
    return { category: 'implement', suggestedSkills: INTENT_SKILL_MAP.implement };
  }

  if (hasTestPhrase) {
    return { category: 'test', suggestedSkills: INTENT_SKILL_MAP.test };
  }

  return { category: 'unknown', suggestedSkills: [] };
}

export type Complexity = 'trivial' | 'complex';

export type PlannerScope = 'trivial' | 'lightweight' | 'complex';
export type PlannerRoutingMode = 'auto' | 'builtin' | 'full';

const COMPLEX_KEYWORDS = ['feature', 'refactor', 'migrate', 'architecture', 'plan', 'redesign'];
const SEQUENTIAL_PATTERN = /\b(then|after|additionally|furthermore|meanwhile)\b/i;

export function classifyComplexity(message: string): Complexity {
  const lower = message.toLowerCase().trim();
  if (!lower) return 'trivial';

  if (COMPLEX_KEYWORDS.some(k => lower.includes(k))) return 'complex';
  if (SEQUENTIAL_PATTERN.test(lower)) return 'complex';

  const fileRefs = (lower.match(/\b\w+\.\w+\b/g) || []).length;
  if (fileRefs > 2) return 'complex';

  const sentences = lower.split(/[.!?\n]+/).filter(Boolean);
  if (sentences.length > 3) return 'complex';

  return 'trivial';
}

export function classifyPlannerScope(message: string): PlannerScope {
  const lower = message.toLowerCase().trim();
  if (!lower) return 'trivial';

  const intent = classifyIntent(message);
  if (intent.category !== 'implement') return 'trivial';

  if (COMPLEX_KEYWORDS.some(k => lower.includes(k))) return 'complex';
  if (SEQUENTIAL_PATTERN.test(lower)) return 'complex';

  const fileRefs = (lower.match(/\b\w+\.\w+\b/g) || []).length;
  if (fileRefs > 2) return 'complex';

  const sentenceText = lower.replace(/\b\w+\.\w+\b/g, 'file');
  const sentences = sentenceText.split(/[.!?\n]+/).filter(Boolean);
  if (sentences.length > 3) return 'complex';

  const tokens = lower.split(/\s+/).filter(Boolean).length;
  if (tokens <= 6 && fileRefs <= 1 && sentences.length <= 1) return 'trivial';
  if (tokens <= 14 && fileRefs <= 2 && sentences.length <= 2) return 'lightweight';

  return 'complex';
}

export function classifyPlannerRoute(message: string, mode: PlannerRoutingMode = 'auto'): PlannerRoutingContext {
  const scope = classifyPlannerScope(message);

  if (scope === 'trivial') {
    return { mode, route: 'trivial', reason: 'simple request' };
  }

  if (mode === 'full') {
    return { mode, route: 'full', reason: 'forced-full override' };
  }

  if (scope === 'lightweight') {
    if (mode === 'builtin' || mode === 'auto') {
      return { mode, route: 'builtin', reason: 'eligible lightweight boundary' };
    }
  }

  return {
    mode,
    route: 'full',
    reason: scope === 'complex' ? 'outside lightweight boundary' : 'not eligible for builtin route',
  };
}

export function requestMatchesPlan(message: string, plan: string): boolean {
  const messageTokens = message.toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 0 && !STOPWORDS.has(t));

  if (messageTokens.length === 0) return false;

  const planTokens = new Set(
    plan.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length > 0 && !STOPWORDS.has(t)),
  );

  const overlap = messageTokens.filter(t => planTokens.has(t)).length;
  const threshold = Math.ceil(messageTokens.length * 0.3);

  return overlap >= threshold;
}

export type ProcessMessageResult =
  | { type: 'block'; reason: 'no_active_plan'; message: string }
  | { type: 'block'; reason: 'plan_not_approved'; message: string }
  | { type: 'block'; reason: 'plan_mismatch'; message: string }
  | { type: 'proceed'; intent: IntentClassification['category']; context?: 'trivial' | 'lightweight' | 'complex' };

export function processMessage(
  message: string,
  planIndex?: PlanIndex | null,
  planContent?: string | null,
): ProcessMessageResult {
  const intent = classifyIntent(message);

  if (intent.category === 'implement') {
    const index = planIndex !== undefined ? planIndex : readPlanIndex();
    const route = classifyPlannerRoute(message);

    // Trivial tasks don't need a plan
    if (route.route === 'trivial') {
      return { type: 'proceed', intent: intent.category, context: 'trivial' };
    }

    // Lightweight tasks can use the built-in planner fast path.
    if (!index || index.activePlanId === null) {
      if (route.route === 'builtin') {
        const root = index?.projectDir ? findProjectRoot(index.projectDir) : findProjectRoot();
        if (root) {
          createBuiltinPlan({ goal: message, source: 'user' }, root);
        }
        return { type: 'proceed', intent: intent.category, context: 'lightweight' };
      }

      // Complex tasks stay on the current planner path.
      return { type: 'proceed', intent: intent.category, context: 'complex' };
    }

    const approvalBlock = getExecutionApprovalBlock(index);
    if (approvalBlock) {
      return {
        type: 'block',
        reason: 'plan_not_approved',
        message: approvalBlock,
      };
    }

    let content: string | null = planContent !== undefined ? planContent : null;
    if (content === null && planContent === undefined) {
      const root = findProjectRoot();
      if (root) {
        const active = getLatestActivePlan(root);
        content = active?.content ?? null;
      }
    }

    if (content !== null && !requestMatchesPlan(message, content)) {
      return {
        type: 'block',
        reason: 'plan_mismatch',
        message: 'Active plan doesn\'t match this request. Clarify or create a new plan.',
      };
    }
  }

  return { type: 'proceed', intent: intent.category };
}

export function checkPlanDrift(editedFiles: string[], planScope: string[]): { inScope: string[]; outOfScope: string[] } {
  const workRoot = findProjectRoot();
  const resolvePath = (p: string) => workRoot ? path.resolve(workRoot, p) : path.resolve(p);
  const planSet = new Set(planScope.map(resolvePath));
  const inScope: string[] = [];
  const outOfScope: string[] = [];

  for (const file of editedFiles) {
    const normalized = resolvePath(file);
    if (planSet.has(normalized)) {
      inScope.push(file);
    } else {
      outOfScope.push(file);
    }
  }

  return { inScope, outOfScope };
}

export function assertTaskScope(editedFiles: string[], planScope: string[]): { ok: boolean; inScope: string[]; outOfScope: string[]; message?: string } {
  const { inScope, outOfScope } = checkPlanDrift(editedFiles, planScope);
  if (outOfScope.length > 0) {
    return { ok: false, inScope, outOfScope, message: `Task scope violation: edited files outside plan scope: [${outOfScope.join(', ')}]` };
  }
  return { ok: true, inScope, outOfScope };
}

export async function runWaveGates(
  gates: Gate[],
): Promise<{ results: GateResult[]; evidence: GateEvidence[] }> {
  const results = await runGates(gates);

  const evidence = results.map(r => gateResultToEvidence(r));

  if (gates.length > 0 && evidence.length > 0) {
    const gateRoot = findProjectRoot();
    if (gateRoot) {
      const gateIndex = readPlanIndex(gateRoot);
      if (gateIndex?.activePlanId) {
        const timestamp = new Date().toISOString();
        appendExecutionArtifact(gateIndex.activePlanId, {
          attempt: 0,
          gateEvidence: evidence,
          completed: false,
          summary: `wave gates: ${evidence.filter(e => e.status === 'PASS').length}/${evidence.length} passed`,
          timestamp,
        }, gateRoot);
      }
    }
  }

  return { results, evidence };
}


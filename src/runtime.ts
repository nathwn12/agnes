import {
  findProjectRoot,
  getLatestActivePlan,
  readPlanIndex,
  updatePlanStatus,
  createPlanIteration,
  extractPromiseTag,
  freshStruggleMetrics,
  updateStruggleMetrics,
  detectStruggle,
} from './state.js';
import type { PlanIndexEntry, PlanIndex, ActivePlan, StruggleMetrics } from './state.js';
import { MiddlewareChain } from './middleware.js';
import type { WaveContext, SubagentContext } from './middleware.js';
import { FlowController } from './flowcontrol.js';
import type { JumpTarget } from './flowcontrol.js';
import type { TaskDescriptor } from './schema.js';
import type { ResultMessage, CompletionStatus } from './protocol.js';
import { runGates } from './verification.js';
import type { Gate, GateResult } from './verification.js';

const MAX_RETRIES_BEFORE_BLOCK = 3;
const MAX_BLOCK_CHAIN = 3;

interface SessionState {
  attempts: number;
  struggle: StruggleMetrics;
  lastPromiseTag: CompletionStatus | null;
  lastAccessed: number;
}

const sessions = new Map<string, SessionState>();
const MAX_SESSIONS = 200;
const SESSION_TTL_MS = 3600000;

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

function getSession(sessionId: string): SessionState {
  let s = sessions.get(sessionId);
  if (!s) {
    s = { attempts: 0, struggle: freshStruggleMetrics(), lastPromiseTag: null, lastAccessed: Date.now() };
    sessions.set(sessionId, s);
  } else {
    s.lastAccessed = Date.now();
    sessions.delete(sessionId);
    sessions.set(sessionId, s);
  }
  return s;
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
    ? [...planIndex.plans].sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime();
        const bTime = new Date(b.updatedAt).getTime();
        if (isNaN(aTime) && isNaN(bTime)) return b.id.localeCompare(a.id);
        if (isNaN(aTime)) return 1;
        if (isNaN(bTime)) return -1;
        const diff = bTime - aTime;
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
      })[0].id
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
    return '\n**PLAN REQUIRED:** No plan index found. Initialize AGNES state first.';
  }
  if (!state.hasActivePlan) {
    return '\n**PLAN REQUIRED:** No active plan found. Create a plan with `.agnes/` before any implementation work.';
  }
  if (state.activePlan && state.activePlan.entry.status === 'blocked') {
    return `\n**BLOCKED PLAN:** ${state.activePlan.entry.id} is blocked. Resolve or create a new iteration.`;
  }
  return null;
}

export const getCurrentState = getPlanState;

export interface IterationReport {
  iteration: number;
  durationMs: number;
  hadProgress: boolean;
  errors: string[];
  promiseTag: CompletionStatus | null;
  completionDetected: boolean;
  exitCode: number;
}

export function checkIterationCompletion(
  output: string,
  _promise?: string,
): { detected: boolean; tag: CompletionStatus | null } {
  const tag = extractPromiseTag(output);
  const detected = tag !== null;
  return { detected, tag };
}

export function buildIterationReport(input: {
  iteration: number;
  durationMs: number;
  filesChanged: number;
  errors: string[];
  output: string;
  exitCode: number;
  completionPromise?: string;
}): IterationReport {
  const { detected, tag } = checkIterationCompletion(input.output, input.completionPromise);
  return {
    iteration: input.iteration,
    durationMs: input.durationMs,
    hadProgress: input.filesChanged > 0,
    errors: input.errors,
    promiseTag: tag,
    completionDetected: detected,
    exitCode: input.exitCode,
  };
}

export function mergeIterationIntoState(
  state: AgnesRuntimeState,
  report: IterationReport,
): {
  struggleWarnings: string[];
  completed: boolean;
} {
  state.iteration = report.iteration;
  state.struggle = state.struggle ?? freshStruggleMetrics();
  state.struggle = updateStruggleMetrics(state.struggle, {
    hadProgress: report.hadProgress,
    durationMs: report.durationMs,
    errors: report.errors,
    promiseTag: report.promiseTag,
  });

  const struggleWarnings = detectStruggle(state.struggle);
  const completed = report.completionDetected;

  return { struggleWarnings, completed };
}

export function recordAttempt(
  sessionId: string,
  promiseTag: CompletionStatus | null,
  projectRoot?: string,
  completionPromise = 'DONE',
): { attempt: number; completed: boolean; blocked?: boolean } {
  const state = getSession(sessionId);

  const root = projectRoot ?? findProjectRoot();
  if (root) {
    const index = readPlanIndex(root);
    if (index?.activePlanId) {
      const activeEntry = index.plans.find(p => p.id === index.activePlanId);
      if (activeEntry?.status === 'blocked') {
        state.attempts++;
        return { attempt: state.attempts, completed: false, blocked: true };
      }
    }
  }

  const completed = promiseTag !== null && promiseTag === completionPromise;

  if (completed) {
    state.lastPromiseTag = promiseTag;
    state.attempts = 0;
    state.struggle = freshStruggleMetrics();
    pruneSessions();
    persistToPlan('done', 0, freshStruggleMetrics(), projectRoot);
    return { attempt: 0, completed: true };
  }

  state.attempts++;
  state.struggle = updateStruggleMetrics(state.struggle, {
    hadProgress: false,
    durationMs: 0,
    errors: [],
    promiseTag: null,
  });

  if (state.attempts >= MAX_RETRIES_BEFORE_BLOCK) {
    autoBlockPlan(projectRoot, state.attempts, state.struggle);
    state.attempts = 0;
    state.struggle = freshStruggleMetrics();
    pruneSessions();
    return { attempt: MAX_RETRIES_BEFORE_BLOCK, completed: false, blocked: true };
  }

  persistToPlan('in_progress', state.attempts, state.struggle, projectRoot);
  return { attempt: state.attempts, completed: false };
}

function autoBlockPlan(projectRoot: string | undefined, attempts: number, struggle: StruggleMetrics): void {
  try {
    const root = projectRoot ?? findProjectRoot();
    if (!root) return;
    const active = getLatestActivePlan(root);
    if (!active) return;

    if (active.entry.blocked >= MAX_BLOCK_CHAIN) {
      createPlanIteration({
        parent: active.entry.id,
        summary: 'Cascade abandon: blocked chain exceeded limit',
        goal: active.content.match(/^Goal:\s*(.+)$/m)?.[1] ?? 'Unknown goal',
        check: active.content.match(/^Check:\s*(.+)$/m)?.[1] ?? 'unknown check',
        tasksMarkdown: (active.content.match(/Tasks:\n([\s\S]*?)(?:\n\n|$)/)?.[1]?.trim()) ?? '- [ ] Unknown',
        status: 'abandoned',
        completed: active.entry.completed,
        blocked: active.entry.blocked,
        attempts,
        struggle,
        projectRoot: root,
      });
      return;
    }

    const goalMatch = active.content.match(/^Goal:\s*(.+)$/m);
    const checkMatch = active.content.match(/^Check:\s*(.+)$/m);
    const goal = goalMatch ? goalMatch[1] : 'Unknown goal';
    const check = checkMatch ? checkMatch[1] : 'unknown check';

    const tasksMatch = active.content.match(/Tasks:\n([\s\S]*?)(?:\n\n|$)/);
    const tasksMarkdown = tasksMatch ? tasksMatch[1].trim() : '- [ ] Unknown';

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
  } catch {
    // Auto-block must never break message transformation.
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
    if (!index || !index.activePlanId) return;
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
  } catch {
    // State persistence must never break message transformation.
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
      lines.push(`Last promise tag seen: <promise>${s.lastPromiseTag}</promise>`);
    }
  }

  lines.push('Output {"type":"completion","status":"DONE","summary":"..."} when the task is genuinely complete.');

  return lines.join('\n');
}

const IMPLEMENT_WORDS = new Set([
  'implement', 'build', 'add', 'fix', 'change', 'create', 'refactor',
  'write', 'edit', 'update', 'remove', 'delete', 'bug', 'broken',
  'fails', 'error', 'test', 'feature', 'support', 'need', 'want', 'should',
]);

const CLARIFY_PATTERNS = ['what is', 'how does', 'explain', 'why', 'describe', 'tell me', 'show me'];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'and', 'or', 'is', 'it', 'be', 'this', 'that',
]);

export function classifyIntent(message: string): 'implement' | 'clarify' | 'plan' | 'unknown' {
  const lower = message.toLowerCase().trim();
  if (!lower) return 'unknown';

  if (lower.includes('?') || CLARIFY_PATTERNS.some(p => lower.includes(p))) {
    return 'clarify';
  }

  const tokens = lower.split(/[^a-z0-9]+/).filter(t => t.length > 0);

  const hasImplPhrase = lower.includes("doesn't work") || lower.includes("test fails");
  const hasImplToken = tokens.some(t => IMPLEMENT_WORDS.has(t));
  const hasImplementationSignal = hasImplPhrase || hasImplToken;

  const hasPlanToken = tokens.some(t => t === 'plan');

  if (hasPlanToken && hasImplementationSignal) {
    return 'plan';
  }

  if (hasImplementationSignal) {
    return 'implement';
  }

  return 'unknown';
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
  | { type: 'block'; reason: 'plan_mismatch'; message: string }
  | { type: 'proceed'; intent: 'implement' | 'clarify' | 'plan' | 'unknown' };

export function processMessage(
  message: string,
  planIndex?: PlanIndex | null,
  planContent?: string | null,
): ProcessMessageResult {
  const intent = classifyIntent(message);

  if (intent === 'implement') {
    const index = planIndex !== undefined ? planIndex : readPlanIndex();

    if (!index || index.activePlanId === null) {
      return {
        type: 'block',
        reason: 'no_active_plan',
        message: 'I need a plan before I can implement. Do you have a plan in mind?',
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

  return { type: 'proceed', intent };
}

export function checkPlanDrift(editedFiles: string[], planScope: string[]): { inScope: string[]; outOfScope: string[] } {
  const planSet = new Set(planScope);
  const inScope: string[] = [];
  const outOfScope: string[] = [];

  for (const file of editedFiles) {
    if (planSet.has(file)) {
      inScope.push(file);
    } else {
      outOfScope.push(file);
    }
  }

  return { inScope, outOfScope };
}

export function assertTaskScope(editedFiles: string[], planScope: string[]): void {
  const { outOfScope } = checkPlanDrift(editedFiles, planScope);
  if (outOfScope.length > 0) {
    throw new Error(`Task scope violation: edited files outside plan scope: [${outOfScope.join(', ')}]`);
  }
}

export async function executeWave(
  planId: string,
  tasks: TaskDescriptor[],
  middleware: MiddlewareChain,
  flow: FlowController,
): Promise<{ results: ResultMessage[]; nextAction: JumpTarget | null }> {
  let waveCtx: WaveContext = {
    planId,
    waveIndex: 0,
    tasks,
    state: {},
  };

  waveCtx = await middleware.executeBeforeWave(waveCtx);

  const beforeJump = flow.getJump();
  if (beforeJump) {
    return { results: [], nextAction: beforeJump };
  }

  const results: ResultMessage[] = [];

  for (const task of tasks) {
    const subCtx: SubagentContext = { task, wave: waveCtx };

    if (flow.shouldSkip()) {
      flow.consumeSignal();
      continue;
    }
    if (flow.isBlocked()) {
      break;
    }

    const handler = async (_ctx: SubagentContext): Promise<ResultMessage> => {
      throw new Error('Subagent handler not yet wired — executeWave is structural only');
    };

    try {
      const result = await middleware.executeSubagent(subCtx, handler);
      results.push(result);
    } catch (err) {
      results.push({
        type: 'error',
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        taskId: `task-${task.skill}`,
        errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
        detail: err instanceof Error ? err.message : String(err),
      } as unknown as ResultMessage);
    }

    const jump = flow.getJump();
    if (jump) {
      return { results, nextAction: jump };
    }
  }

  waveCtx = await middleware.executeAfterWave(waveCtx, results);

  const finalJump = flow.getJump();
  return { results, nextAction: finalJump };
}

export async function runWaveGates(
  gates: Gate[],
  flow: FlowController,
): Promise<GateResult[]> {
  const results = await runGates(gates);

  for (const result of results) {
    if (result.status === 'FAIL') {
      const gate = gates.find(g => g.id === result.gateId);
      if (gate?.isBlocking) {
        flow.setJump('blocked', `Gate ${result.gateId} failed: ${result.evidence.errors.join('; ')}`);
        break;
      }
    }
  }

  return results;
}


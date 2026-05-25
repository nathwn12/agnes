import * as fs from 'node:fs';
import * as path from 'node:path';

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
  cacheDir,
} from './state.js';
import type { PlanIndexEntry, PlanIndex, ActivePlan, StruggleMetrics } from './state.js';
import { MiddlewareChain } from './middleware.js';
import type { WaveContext, SubagentContext } from './middleware.js';
import { FlowController } from './flowcontrol.js';
import type { JumpTarget } from './flowcontrol.js';
import type { TaskDescriptor } from './schema.js';
import type { ResultMessage, CompletionStatus } from './protocol.js';
import { detectShell } from './shell.js';
import type { ShellType } from './shell.js';
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
  } catch {
    // Persistence must never break runtime.
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
  } catch {
    // Load must never break runtime.
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
  shellType?: ShellType;
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
  if (state.activePlan?.entry.status === 'blocked') {
    return `\n**BLOCKED PLAN:** ${state.activePlan.entry.id} is blocked. Resolve or create a new iteration.`;
  }
  const approvalBlock = getExecutionApprovalBlock(state.planIndex);
  if (approvalBlock) {
    return `\n**APPROVAL REQUIRED:** ${approvalBlock}`;
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
        persistSessions(root);
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
    persistSessions(projectRoot);
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
    persistSessions(projectRoot);
    return { attempt: MAX_RETRIES_BEFORE_BLOCK, completed: false, blocked: true };
  }

  persistToPlan('in_progress', state.attempts, state.struggle, projectRoot);
  persistSessions(projectRoot);
  return { attempt: state.attempts, completed: false };
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
  } catch {
    // State persistence must never break message transformation.
  }
}

export function buildExecutionContext(entry: PlanIndexEntry): string {
  const lines: string[] = [];

  if (entry.attempts !== undefined && entry.attempts > 0) {
    lines.push(`Current attempt: ${entry.attempts + 1}`);
  }

  const shell = detectShell();
  lines.push(`Shell: ${shell.shellType} (preferred syntax: ${shell.preferredSyntax})`);
  lines.push(`Shell guidance: ${shell.guidance}`);

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
  implement: ['builder'],
  clarify: ['clarifier'],
  plan: ['planner', 'prd'],
  review: ['reviewer', 'verifier'],
  test: ['tdd', 'tester'],
  debug: ['debugger', 'griller'],
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
  | { type: 'proceed'; intent: IntentClassification['category'] };

export function processMessage(
  message: string,
  planIndex?: PlanIndex | null,
  planContent?: string | null,
): ProcessMessageResult {
  const intent = classifyIntent(message);

  if (intent.category === 'implement') {
    const index = planIndex !== undefined ? planIndex : readPlanIndex();

    if (!index || index.activePlanId === null) {
      return {
        type: 'block',
        reason: 'no_active_plan',
        message: 'I need a plan before I can implement. Do you have a plan in mind?',
      };
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

    // TODO: Wire subagent spawning via OpenCode API. Currently returns a BLOCKED result for each task.
    const handler = async (_ctx: SubagentContext): Promise<ResultMessage> => ({
      type: 'result',
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      taskId: `task-${_ctx.task.skill}`,
      status: 'BLOCKED',
      content: `Subagent handler not yet wired — executeWave is structural only. Task ${_ctx.task.skill} skipped.`,
    });

    try {
      const result = await middleware.executeSubagent(subCtx, handler);
      results.push(result);
    } catch (err) {
      results.push({
        type: 'result',
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        taskId: `task-${task.skill}`,
        status: 'BLOCKED',
        content: err instanceof Error ? err.message : String(err),
      });
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
  const blockingFailure = results.find((result) => {
    const gate = gates.find(candidate => candidate.id === result.gateId);
    return gate?.isBlocking === true && result.status === 'FAIL';
  });

  if (blockingFailure) {
    flow.setJump('blocked', `blocking_gate_failed:${blockingFailure.gateId}`, {
      gateId: blockingFailure.gateId,
    });
  }

  return results;
}


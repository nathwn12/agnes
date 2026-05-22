import {
  findProjectRoot,
  getLatestActivePlan,
  readPlanIndex,
  detectPromiseTag,
  extractPromiseTag,
  freshStruggleMetrics,
  updateStruggleMetrics,
  detectStruggle,
  extractErrorsFromOutput,
} from './state.js';
import type { PlanIndexEntry, PlanIndex, ActivePlan, StruggleMetrics } from './state.js';

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
    return `\n**PLAN REQUIRED:** No active plan found. Create a plan with \`.cache/agnes/\` before any implementation work.`;
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
    ? [...planIndex.plans].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0].id
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
    return '\n**PLAN REQUIRED:** No active plan found. Create a plan with `.cache/agnes/` before any implementation work.';
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
  promiseTag: string | null;
  completionDetected: boolean;
  exitCode: number;
}

export function checkIterationCompletion(
  output: string,
  promise?: string,
): { detected: boolean; tag: string | null } {
  const detected = promise ? detectPromiseTag(output, promise) : detectPromiseTag(output);
  const tag = extractPromiseTag(output);
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

  lines.push('Output <promise>DONE</promise> when the task is genuinely complete.');

  return lines.join('\n');
}

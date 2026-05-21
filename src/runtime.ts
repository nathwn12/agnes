import { findProjectRoot, getLatestActivePlan, readPlanIndex } from './state.js';
import type { PlanIndexEntry, PlanIndex, ActivePlan } from './state.js';

export interface AgnesRuntimeState {
  hasActivePlan: boolean;
  activePlanId: string | null;
  planContent: string | null;
  planEntry: PlanIndexEntry | null;
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

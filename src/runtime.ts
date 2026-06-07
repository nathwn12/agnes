import {
  findProjectRoot,
  getLatestActivePlan,
  readPlanIndex,
} from './state.js';
import type { PlanIndex, ActivePlan } from './state.js';

export function setYoloMode(_enabled: boolean): void {
}

export function getPlanState(workspaceRoot?: string | null): {
  hasActivePlan: boolean;
  activePlan: ActivePlan | null;
  planIndex: PlanIndex | null;
} {
  if (workspaceRoot === undefined) {
    workspaceRoot = findProjectRoot();
  }
  if (!workspaceRoot) {
    return { hasActivePlan: false, activePlan: null, planIndex: null };
  }

  const planIndex = readPlanIndex(workspaceRoot);
  if (!planIndex) {
    return { hasActivePlan: false, activePlan: null, planIndex: null };
  }

  const active = getLatestActivePlan(workspaceRoot);

  return {
    hasActivePlan: active !== null,
    activePlan: active,
    planIndex,
  };
}

export function getPlanGate(workspaceRoot?: string | null): string | null {
  const state = getPlanState(workspaceRoot);
  if (!state.planIndex || !state.activePlan) {
    return null;
  }
  return null;
}



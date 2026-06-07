import {
  findProjectRoot,
  getLatestActivePlan,
  readPlanIndex,
} from './state.js';
import type { PlanIndex, ActivePlan } from './state.js';

let _yoloMode = false;

export function setYoloMode(enabled: boolean): void {
  _yoloMode = enabled;
}

export function isYoloMode(): boolean {
  return _yoloMode;
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
  const { status } = state.activePlan.entry;
  if (status === 'draft' || status === 'reviewed') {
    return `Plan ${state.activePlan.entry.id} is in status "${status}" and needs approval before execution.`;
  }
  return null;
}



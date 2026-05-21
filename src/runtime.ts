import { findProjectRoot, getLatestActivePlan, readPlanIndex } from './state.js';
import type { PlanIndexEntry } from './state.js';

export interface AgnesRuntimeState {
  hasActivePlan: boolean;
  activePlanId: string | null;
  planContent: string | null;
  planEntry: PlanIndexEntry | null;
}

export function getCurrentState(workspaceRoot?: string | null): AgnesRuntimeState | null {
  if (workspaceRoot === undefined) {
    workspaceRoot = findProjectRoot();
  }
  if (!workspaceRoot) return null;

  const index = readPlanIndex(workspaceRoot);
  if (!index) {
    return {
      hasActivePlan: false,
      activePlanId: null,
      planContent: null,
      planEntry: null,
    };
  }

  const active = getLatestActivePlan(workspaceRoot);
  if (!active) {
    return {
      hasActivePlan: false,
      activePlanId: null,
      planContent: null,
      planEntry: null,
    };
  }

  return {
    hasActivePlan: true,
    activePlanId: active.entry.id,
    planContent: active.content,
    planEntry: active.entry,
  };
}

export function getPlanGateFromState(state: AgnesRuntimeState): string | null {
  if (!state.hasActivePlan) {
    return `\n**PLAN REQUIRED:** No active plan found. Create a plan with \`.cache/agnes/\` before any implementation work.`;
  }
  return null;
}

export function getPlanGate(): string | null {
  const state = getCurrentState();
  if (!state) return null;
  return getPlanGateFromState(state);
}

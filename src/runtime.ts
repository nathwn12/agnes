import { detectStateDirectory, getStateSnapshot } from './state.js';
import type { StateSnapshot } from './state.js';

export interface AgnesRuntimeState {
  hasGoal: boolean;
  hasPlan: boolean;
  hasHandoff: boolean;
  goalContent: string | null;
  planContent: string | null;
  handoffContent: string | null;
}

export function getCurrentState(workspaceRoot?: string | null, snapshot?: StateSnapshot): AgnesRuntimeState | null {
  if (workspaceRoot === undefined) {
    workspaceRoot = detectStateDirectory();
  }
  if (!workspaceRoot) return null;

  const snap = snapshot ?? getStateSnapshot(workspaceRoot);
  const { files, goal, handoff, plan } = snap;

  const goalActive = files.includes('goal.md') && goal?.status === 'active';
  const planActive = files.includes('plan.md') && plan?.status === 'active';
  const handoffActive = files.includes('handoff.md') && handoff?.status === 'active';

  return {
    hasGoal: goalActive,
    hasPlan: planActive,
    hasHandoff: handoffActive,
    goalContent: goalActive ? goal.content : null,
    planContent: planActive ? plan.content : null,
    handoffContent: handoffActive ? handoff.content : null,
  };
}

export function getPlanGateFromState(state: AgnesRuntimeState): string | null {
  if (state.hasGoal && !state.hasPlan) {
    return `\n**PLAN REQUIRED:** \`docs/agnes/plan.md\` does not exist but \`docs/agnes/goal.md\` does. Create \`docs/agnes/plan.md\` with a task checklist before any implementation work.`;
  }
  return null;
}

export function getPlanGate(): string | null {
  const state = getCurrentState();
  if (!state) return null;
  return getPlanGateFromState(state);
}

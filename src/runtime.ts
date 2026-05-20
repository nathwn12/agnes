import { findWorkspaceRoot, readStateFile } from './state.js';

export interface AgnesRuntimeState {
  hasGoal: boolean;
  hasPlan: boolean;
  hasHandoff: boolean;
  goalContent: string | null;
  planContent: string | null;
  handoffContent: string | null;
}

export function getCurrentState(): AgnesRuntimeState | null {
  const workspaceRoot = findWorkspaceRoot();
  if (!workspaceRoot) return null;

  return {
    hasGoal: readStateFile(workspaceRoot, 'goal.md') !== null,
    hasPlan: readStateFile(workspaceRoot, 'plan.md') !== null,
    hasHandoff: readStateFile(workspaceRoot, 'handoff.md') !== null,
    goalContent: readStateFile(workspaceRoot, 'goal.md'),
    planContent: readStateFile(workspaceRoot, 'plan.md'),
    handoffContent: readStateFile(workspaceRoot, 'handoff.md'),
  };
}

/**
 * Phase 3 invariant: plan-before-implementation gate.
 * If goal.md exists but plan.md does not, returns a directive
 * telling the agent to create plan.md before proceeding.
 */
export function getPlanGate(): string | null {
  const state = getCurrentState();
  if (!state) return null;

  if (state.hasGoal && !state.hasPlan) {
    return `\n**PLAN REQUIRED:** \`docs/agnes/plan.md\` does not exist but \`docs/agnes/goal.md\` does. Create \`docs/agnes/plan.md\` with a task checklist before any implementation work.`;
  }

  return null;
}

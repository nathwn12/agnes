import { detectStateDirectory, readStateFile, listStateFiles, getFileStatus } from './state.js';

export interface AgnesRuntimeState {
  hasGoal: boolean;
  hasPlan: boolean;
  hasHandoff: boolean;
  goalContent: string | null;
  planContent: string | null;
  handoffContent: string | null;
}

export function getCurrentState(): AgnesRuntimeState | null {
  const workspaceRoot = detectStateDirectory();
  if (!workspaceRoot) return null;

  const files = listStateFiles(workspaceRoot);
  const goalActive = files.includes('goal.md') && getFileStatus(workspaceRoot, 'goal.md') === 'active';
  const planActive = files.includes('plan.md') && getFileStatus(workspaceRoot, 'plan.md') === 'active';
  const handoffActive = files.includes('handoff.md') && getFileStatus(workspaceRoot, 'handoff.md') === 'active';

  return {
    hasGoal: goalActive,
    hasPlan: planActive,
    hasHandoff: handoffActive,
    goalContent: goalActive ? readStateFile(workspaceRoot, 'goal.md') : null,
    planContent: planActive ? readStateFile(workspaceRoot, 'plan.md') : null,
    handoffContent: handoffActive ? readStateFile(workspaceRoot, 'handoff.md') : null,
  };
}

export function getPlanGate(): string | null {
  const state = getCurrentState();
  if (!state) return null;

  if (state.hasGoal && !state.hasPlan) {
    return `\n**PLAN REQUIRED:** \`docs/agnes/plan.md\` does not exist but \`docs/agnes/goal.md\` does. Create \`docs/agnes/plan.md\` with a task checklist before any implementation work.`;
  }

  return null;
}

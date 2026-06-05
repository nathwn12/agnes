// Loop state management — orchestrator-decides loop evaluation

export interface LoopConfig {
  max: number;
  until: string;
}

export interface LoopState {
  config: LoopConfig;
  iteration: number;
  commandName: string;
  commandArgs: string;
  model?: string;
  agent?: string;
  deferredReturns?: string[];
}

const activeLoops = new Map<string, LoopState>();
const pendingEvaluations = new Map<string, LoopState>();

export function startLoop(
  sessionID: string,
  config: LoopConfig,
  commandName: string,
  commandArgs: string,
  model?: string,
  agent?: string,
  deferredReturns?: string[],
): void {
  activeLoops.set(sessionID, {
    config,
    iteration: 1,
    commandName,
    commandArgs,
    model,
    agent,
    deferredReturns,
  });
}

export function getLoopState(sessionID: string): LoopState | undefined {
  return activeLoops.get(sessionID);
}

export function incrementLoopIteration(sessionID: string): number {
  const state = activeLoops.get(sessionID);
  if (state) {
    state.iteration++;
    return state.iteration;
  }
  return 0;
}

export function clearLoop(sessionID: string): void {
  activeLoops.delete(sessionID);
}

export function isLoopComplete(sessionID: string): boolean {
  const state = activeLoops.get(sessionID);
  if (!state) return true;
  return state.iteration >= state.config.max;
}

export function setPendingEvaluation(sessionID: string, state: LoopState): void {
  pendingEvaluations.set(sessionID, state);
}

export function getPendingEvaluation(sessionID: string): LoopState | undefined {
  return pendingEvaluations.get(sessionID);
}

export function clearPendingEvaluation(sessionID: string): void {
  pendingEvaluations.delete(sessionID);
}

export function getAllPendingEvaluations(): Map<string, LoopState> {
  return pendingEvaluations;
}

export function parseLoopDecision(output: string): 'break' | 'continue' {
  const match = output.match(/<subtask2\s+loop=["']?break["']?\s*\/?>/i);
  return match ? 'break' : 'continue';
}

export function createEvaluationPrompt(until: string, iteration: number, max: number): string {
  return `**Loop Evaluation (iteration ${iteration}/${max})**
Condition: "${until}"
If the condition is met, respond with: <subtask2 loop="break"/>
If not met, respond with your current progress and what you're working on next.`;
}

export function createYieldPrompt(iteration: number, max: number): string {
  return `**Loop Iteration ${iteration}/${max}**
Continue working. Respond with your progress and next steps.`;
}

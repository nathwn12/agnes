// Return chain state management
// Each session can have a chain of return items executed sequentially on session.idle

const returnChains = new Map<string, string[]>();
const returnStacks = new Map<string, string[][]>();
const deferredPromptReturns = new Map<string, string>();
const pendingPromptReturns = new Map<string, string>();
const lastReturnTypes = new Map<string, 'inline_subtask' | 'command' | 'prompt'>();
const pendingStackedResponses = new Set<string>();

export function hasReturnChain(sessionID: string): boolean {
  return returnChains.has(sessionID);
}

export function shiftReturnChain(sessionID: string): string | undefined {
  const chain = returnChains.get(sessionID);
  if (!chain || chain.length === 0) return undefined;
  const next = chain.shift();
  if (chain.length === 0) returnChains.delete(sessionID);
  return next;
}

export function pushReturnStack(sessionID: string, items: string[]): void {
  const stack = returnStacks.get(sessionID) ?? [];
  stack.push(items);
  returnStacks.set(sessionID, stack);
}

export function peekReturnStack(sessionID: string): string[] | undefined {
  const stack = returnStacks.get(sessionID);
  return stack?.[stack.length - 1];
}

export function shiftReturnStack(sessionID: string): string | undefined {
  const stack = returnStacks.get(sessionID);
  if (!stack || stack.length === 0) return undefined;
  const current = stack[stack.length - 1];
  if (!current || current.length === 0) {
    stack.pop();
    if (stack.length === 0) returnStacks.delete(sessionID);
    return undefined;
  }
  const next = current.shift();
  if (current.length === 0) {
    stack.pop();
    if (stack.length === 0) returnStacks.delete(sessionID);
  }
  return next;
}

export function hasReturnStack(sessionID: string): boolean {
  const stack = returnStacks.get(sessionID);
  return stack !== undefined && stack.length > 0;
}

export function consumeDeferredPromptReturn(sessionID: string): string | undefined {
  const prompt = deferredPromptReturns.get(sessionID);
  if (prompt) deferredPromptReturns.delete(sessionID);
  return prompt;
}

export function setPendingPromptReturn(sessionID: string, prompt: string): void {
  pendingPromptReturns.set(sessionID, prompt);
}

export function consumePendingPromptReturn(sessionID: string): string | undefined {
  const prompt = pendingPromptReturns.get(sessionID);
  if (prompt) pendingPromptReturns.delete(sessionID);
  return prompt;
}

export function getAllPendingPromptReturns(): Map<string, string> {
  return pendingPromptReturns;
}

export function setLastReturnType(sessionID: string, type: 'inline_subtask' | 'command' | 'prompt'): void {
  lastReturnTypes.set(sessionID, type);
}

export function setPendingStackedResponse(sessionID: string): void {
  pendingStackedResponses.add(sessionID);
}

export function hasPendingStackedResponse(sessionID: string): boolean {
  return pendingStackedResponses.has(sessionID);
}

export function clearPendingStackedResponse(sessionID: string): void {
  pendingStackedResponses.delete(sessionID);
}

export const OPENCODE_GENERIC = 'Summarize the task tool output above and continue with your task.';

export function cleanupSession(sessionID: string): void {
  returnChains.delete(sessionID);
  returnStacks.delete(sessionID);
  deferredPromptReturns.delete(sessionID);
  pendingPromptReturns.delete(sessionID);
  lastReturnTypes.delete(sessionID);
  pendingStackedResponses.delete(sessionID);
}

import type { DelegateTask } from './types.js';

const parentToChildren = new Map<string, Set<string>>();
const tasks = new Map<string, DelegateTask>();
const namedResults = new Map<string, Map<string, string>>();
const groupMembers = new Map<string, Set<string>>();
const groupPendingCounts = new Map<string, number>();

export function trackTask(task: DelegateTask): void {
  tasks.set(task.id, task);
  const children = parentToChildren.get(task.parentSessionID) ?? new Set();
  children.add(task.id);
  parentToChildren.set(task.parentSessionID, children);
}

export function getTask(id: string): DelegateTask | undefined {
  return tasks.get(id);
}

export function getChildTasks(parentSessionID: string): DelegateTask[] {
  const childIds = parentToChildren.get(parentSessionID);
  if (!childIds) return [];
  return Array.from(childIds)
    .map(id => tasks.get(id))
    .filter((t): t is DelegateTask => t !== undefined);
}

export function updateTask(id: string, update: Partial<DelegateTask>): void {
  const task = tasks.get(id);
  if (task) Object.assign(task, update);
}

export function getAllTasks(): DelegateTask[] {
  return Array.from(tasks.values());
}

export function getRunningTasks(): DelegateTask[] {
  return getAllTasks().filter(t => t.status === 'running' || t.status === 'pending');
}

function ensureResultMap(sessionID: string): Map<string, string> {
  if (!namedResults.has(sessionID)) {
    namedResults.set(sessionID, new Map());
  }
  return namedResults.get(sessionID)!;
}

export function storeNamedResult(sessionID: string, name: string, result: string): void {
  ensureResultMap(sessionID).set(name, result);
}

export function getNamedResult(sessionID: string, name: string): string | undefined {
  return namedResults.get(sessionID)?.get(name);
}

export function getAllNamedResults(sessionID: string): Map<string, string> | undefined {
  return namedResults.get(sessionID);
}

export function resolveResultReferences(text: string, sessionID: string): string {
  const results = namedResults.get(sessionID);
  if (!results?.size) return text;
  return text.replace(/\$RESULT\[([^\]]+)\]/g, (match, name) => {
    return results.get(name) ?? match;
  });
}

export function hasRunningChildren(parentSessionID: string): boolean {
  const children = parentToChildren.get(parentSessionID);
  if (!children?.size) return false;
  for (const id of children) {
    const t = tasks.get(id);
    if (t && (t.status === 'running' || t.status === 'pending')) return true;
  }
  return false;
}

export function allChildrenComplete(parentSessionID: string): boolean {
  const children = parentToChildren.get(parentSessionID);
  if (!children?.size) return true;
  for (const id of children) {
    const t = tasks.get(id);
    if (!t || t.status === 'running' || t.status === 'pending') return false;
  }
  return true;
}

export function cleanupSession(sessionID: string): void {
  namedResults.delete(sessionID);
  const children = parentToChildren.get(sessionID);
  if (children) {
    for (const id of children) {
      tasks.delete(id);
    }
    parentToChildren.delete(sessionID);
  }
}

export function cleanupStaleTasks(maxAgeMs = 300_000): number {
  const now = Date.now();
  let count = 0;
  for (const [id, task] of tasks) {
    if (task.completedAt && (now - task.completedAt) > maxAgeMs) {
      tasks.delete(id);
      if (task.groupID) {
        const group = groupMembers.get(task.groupID);
        if (group) {
          group.delete(id);
          if (group.size === 0) groupMembers.delete(task.groupID);
        }
      }
      count++;
    }
  }
  return count;
}

export function validateSessionHasOutput(
  messages: { info?: { role?: string }; parts?: { type?: string; text?: string }[] }[],
): boolean {
  const hasAssistantMessage = messages.some(m => m.info?.role === 'assistant');
  if (!hasAssistantMessage) return false;

  const hasContent = messages.some(m => {
    if (m.info?.role !== 'assistant') return false;
    const parts = m.parts ?? [];
    return parts.some(p =>
      (p.type === 'text' && p.text && p.text.trim().length > 0) ||
      (p.type === 'reasoning' && p.text && p.text.trim().length > 0) ||
      p.type === 'tool'
    );
  });
  return hasContent;
}

export function trackGroup(groupID: string, taskID: string): void {
  const members = groupMembers.get(groupID) ?? new Set();
  members.add(taskID);
  groupMembers.set(groupID, members);
  groupPendingCounts.set(groupID, (groupPendingCounts.get(groupID) ?? 0) + 1);
}

export function markGroupTaskCompleted(groupID: string): number {
  const remaining = (groupPendingCounts.get(groupID) ?? 1) - 1;
  if (remaining <= 0) {
    groupPendingCounts.delete(groupID);
    return 0;
  }
  groupPendingCounts.set(groupID, remaining);
  return remaining;
}

export function getGroupPendingCount(groupID: string): number {
  return groupPendingCounts.get(groupID) ?? 0;
}

export function getGroupTaskIDs(groupID: string): string[] {
  const members = groupMembers.get(groupID);
  return members ? Array.from(members) : [];
}

import type { DelegateTask } from './types.js';

export class SessionStore {
  private parentToChildren = new Map<string, Set<string>>();
  private tasks = new Map<string, DelegateTask>();
  private namedResults = new Map<string, Map<string, string>>();
  private groupMembers = new Map<string, Set<string>>();
  private groupPendingCounts = new Map<string, number>();
  private pendingParentByPrompt = new Map<string, string>();
  private pendingCaptureByPrompt = new Map<string, { parentSessionID: string; name: string }>();

  registerPendingParent(prompt: string, sessionID: string): void {
    this.pendingParentByPrompt.set(prompt, sessionID);
  }

  consumePendingParent(prompt: string): string | null {
    const parent = this.pendingParentByPrompt.get(prompt);
    if (parent) this.pendingParentByPrompt.delete(prompt);
    return parent ?? null;
  }

  registerPendingCapture(prompt: string, parentSessionID: string, name: string): void {
    this.pendingCaptureByPrompt.set(prompt, { parentSessionID, name });
  }

  consumePendingCapture(prompt: string): { parentSessionID: string; name: string } | undefined {
    const entry = this.pendingCaptureByPrompt.get(prompt);
    if (entry) this.pendingCaptureByPrompt.delete(prompt);
    return entry;
  }

  hasPendingCapture(prompt: string): boolean {
    return this.pendingCaptureByPrompt.has(prompt);
  }

  getPendingCapture(prompt: string): { parentSessionID: string; name: string } | undefined {
    return this.pendingCaptureByPrompt.get(prompt);
  }

  trackTask(task: DelegateTask): void {
    this.tasks.set(task.id, task);
    const parent = task.parentSessionID;
    const children = this.parentToChildren.get(parent) ?? new Set<string>();
    children.add(task.id);
    this.parentToChildren.set(parent, children);
  }

  getTask(id: string): DelegateTask | undefined {
    return this.tasks.get(id);
  }

  getChildTasks(parentSessionID: string): DelegateTask[] {
    const childIds = this.parentToChildren.get(parentSessionID);
    if (!childIds) return [];
    return Array.from(childIds)
      .map(id => this.tasks.get(id))
      .filter((t): t is DelegateTask => t !== undefined);
  }

  updateTask(id: string, update: Partial<DelegateTask>): void {
    const task = this.tasks.get(id);
    if (task) Object.assign(task, update);
  }

  getAllTasks(): DelegateTask[] {
    return Array.from(this.tasks.values());
  }

  getRunningTasks(): DelegateTask[] {
    return this.getAllTasks().filter(t => t.status === 'running' || t.status === 'pending');
  }

  private ensureResultMap(sessionID: string): Map<string, string> {
    if (!this.namedResults.has(sessionID)) {
      this.namedResults.set(sessionID, new Map());
    }
    return this.namedResults.get(sessionID)!;
  }

  storeNamedResult(sessionID: string, name: string, result: string): void {
    this.ensureResultMap(sessionID).set(name, result);
  }

  getNamedResult(sessionID: string, name: string): string | undefined {
    return this.namedResults.get(sessionID)?.get(name);
  }

  getAllNamedResults(sessionID: string): Map<string, string> | undefined {
    return this.namedResults.get(sessionID);
  }

  resolveResultReferences(text: string, sessionID: string): string {
    const results = this.namedResults.get(sessionID);
    if (!results?.size) return text;
    return text.replace(/\$RESULT\[([^\]]+)\]/g, (match, name) => {
      return results.get(name) ?? match;
    });
  }

  hasRunningChildren(parentSessionID: string): boolean {
    const children = this.parentToChildren.get(parentSessionID);
    if (!children?.size) return false;
    for (const id of children) {
      const t = this.tasks.get(id);
      if (t && (t.status === 'running' || t.status === 'pending')) return true;
    }
    return false;
  }

  allChildrenComplete(parentSessionID: string): boolean {
    const children = this.parentToChildren.get(parentSessionID);
    if (!children?.size) return true;
    for (const id of children) {
      const t = this.tasks.get(id);
      if (!t || t.status === 'running' || t.status === 'pending') return false;
    }
    return true;
  }

  cleanupSession(sessionID: string): void {
    this.namedResults.delete(sessionID);
    const children = this.parentToChildren.get(sessionID);
    if (children) {
      for (const id of children) {
        this.tasks.delete(id);
      }
      this.parentToChildren.delete(sessionID);
    }
  }

  cleanupStaleTasks(maxAgeMs = 300_000): number {
    const now = Date.now();
    let count = 0;
    for (const [id, task] of this.tasks) {
      if (task.completedAt && (now - task.completedAt) > maxAgeMs) {
        this.tasks.delete(id);
        if (task.groupID) {
          const group = this.groupMembers.get(task.groupID);
          if (group) {
            group.delete(id);
            if (group.size === 0) this.groupMembers.delete(task.groupID);
          }
        }
        count++;
      }
    }
    return count;
  }

  validateSessionHasOutput(
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

  trackGroup(groupID: string, taskID: string): void {
    const members = this.groupMembers.get(groupID) ?? new Set<string>();
    members.add(taskID);
    this.groupMembers.set(groupID, members);
    this.groupPendingCounts.set(groupID, (this.groupPendingCounts.get(groupID) ?? 0) + 1);
  }

  markGroupTaskCompleted(groupID: string): number {
    const remaining = (this.groupPendingCounts.get(groupID) ?? 1) - 1;
    if (remaining <= 0) {
      this.groupPendingCounts.delete(groupID);
      return 0;
    }
    this.groupPendingCounts.set(groupID, remaining);
    return remaining;
  }

  getGroupPendingCount(groupID: string): number {
    return this.groupPendingCounts.get(groupID) ?? 0;
  }

  getGroupTaskIDs(groupID: string): string[] {
    const members = this.groupMembers.get(groupID);
    return members ? Array.from(members) : [];
  }
}

const globalSessionStore = new SessionStore();

export function getGlobalSessionStore(): SessionStore {
  return globalSessionStore;
}

export function trackTask(task: DelegateTask): void {
  globalSessionStore.trackTask(task);
}

export function getTask(id: string): DelegateTask | undefined {
  return globalSessionStore.getTask(id);
}

export function getChildTasks(parentSessionID: string): DelegateTask[] {
  return globalSessionStore.getChildTasks(parentSessionID);
}

export function updateTask(id: string, update: Partial<DelegateTask>): void {
  globalSessionStore.updateTask(id, update);
}

export function getAllTasks(): DelegateTask[] {
  return globalSessionStore.getAllTasks();
}

export function getRunningTasks(): DelegateTask[] {
  return globalSessionStore.getRunningTasks();
}

export function storeNamedResult(sessionID: string, name: string, result: string): void {
  globalSessionStore.storeNamedResult(sessionID, name, result);
}

export function getNamedResult(sessionID: string, name: string): string | undefined {
  return globalSessionStore.getNamedResult(sessionID, name);
}

export function getAllNamedResults(sessionID: string): Map<string, string> | undefined {
  return globalSessionStore.getAllNamedResults(sessionID);
}

export function resolveResultReferences(text: string, sessionID: string): string {
  return globalSessionStore.resolveResultReferences(text, sessionID);
}

export function hasRunningChildren(parentSessionID: string): boolean {
  return globalSessionStore.hasRunningChildren(parentSessionID);
}

export function allChildrenComplete(parentSessionID: string): boolean {
  return globalSessionStore.allChildrenComplete(parentSessionID);
}

export function cleanupSession(sessionID: string): void {
  globalSessionStore.cleanupSession(sessionID);
}

export function cleanupStaleTasks(maxAgeMs = 300_000): number {
  return globalSessionStore.cleanupStaleTasks(maxAgeMs);
}

export function validateSessionHasOutput(
  messages: { info?: { role?: string }; parts?: { type?: string; text?: string }[] }[],
): boolean {
  return globalSessionStore.validateSessionHasOutput(messages);
}

export function trackGroup(groupID: string, taskID: string): void {
  globalSessionStore.trackGroup(groupID, taskID);
}

export function markGroupTaskCompleted(groupID: string): number {
  return globalSessionStore.markGroupTaskCompleted(groupID);
}

export function getGroupPendingCount(groupID: string): number {
  return globalSessionStore.getGroupPendingCount(groupID);
}

export function getGroupTaskIDs(groupID: string): string[] {
  return globalSessionStore.getGroupTaskIDs(groupID);
}

export function registerPendingParent(prompt: string, sessionID: string): void {
  globalSessionStore.registerPendingParent(prompt, sessionID);
}

export function consumePendingParent(prompt: string): string | null {
  return globalSessionStore.consumePendingParent(prompt);
}

export function registerPendingCapture(prompt: string, parentSessionID: string, name: string): void {
  globalSessionStore.registerPendingCapture(prompt, parentSessionID, name);
}

export function consumePendingCapture(prompt: string): { parentSessionID: string; name: string } | undefined {
  return globalSessionStore.consumePendingCapture(prompt);
}

export function hasPendingCapture(prompt: string): boolean {
  return globalSessionStore.hasPendingCapture(prompt);
}

export function getPendingCapture(prompt: string): { parentSessionID: string; name: string } | undefined {
  return globalSessionStore.getPendingCapture(prompt);
}

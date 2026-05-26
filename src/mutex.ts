export class MutexTimeoutError extends Error {
  constructor(key: string, timeout: number) {
    super(`Mutex timeout for key "${key}": waited ${timeout}ms without acquiring lock`);
    this.name = 'MutexTimeoutError';
  }
}

export class SimpleMutex {
  private queues: Map<string, Array<{ resolve: () => void; reject: (err: Error) => void; timer: NodeJS.Timeout }>> = new Map();
  private held: Set<string> = new Set();

  acquire(key: string, timeout: number = 30000): Promise<void> {
    if (!this.held.has(key)) {
      this.held.add(key);
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const queue = this.queues.get(key) ?? [];
      const entry = { resolve, reject, timer: null as unknown as NodeJS.Timeout };
      entry.timer = setTimeout(() => {
        const q = this.queues.get(key);
        if (q) {
          const idx = q.indexOf(entry);
          if (idx >= 0) q.splice(idx, 1);
          if (q.length === 0) this.held.delete(key);
        }
        reject(new MutexTimeoutError(key, timeout));
      }, timeout);
      queue.push(entry);
      this.queues.set(key, queue);
    });
  }

  release(key: string): void {
    const queue = this.queues.get(key);
    if (queue && queue.length > 0) {
      const entry = queue.shift()!;
      if (queue.length === 0) this.queues.delete(key);
      clearTimeout(entry.timer);
      entry.resolve();
    } else {
      this.held.delete(key);
    }
  }
}

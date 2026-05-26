import { SimpleMutex } from './mutex.js';

export class MetricsCounter {
  private counters: Map<string, number> = new Map();
  private mutex = new SimpleMutex();
  private counterLock = 'metrics';

  private async withLock<T>(fn: () => T): Promise<T> {
    await this.mutex.acquire(this.counterLock);
    try {
      return fn();
    } finally {
      this.mutex.release(this.counterLock);
    }
  }

  async increment(key: string, delta: number = 1): Promise<void> {
    try {
      await this.withLock(() => {
        const current = this.counters.get(key) ?? 0;
        this.counters.set(key, current + delta);
      });
    } catch {
      // silently ignore metrics errors
    }
  }

  async get(key: string): Promise<number> {
    return this.withLock(() => {
      return this.counters.get(key) ?? 0;
    });
  }

  async reset(): Promise<void> {
    await this.withLock(() => {
      this.counters.clear();
    });
  }

  async snapshot(): Promise<Record<string, number>> {
    return this.withLock(() => {
      const obj: Record<string, number> = {};
      for (const [key, value] of this.counters) {
        obj[key] = value;
      }
      return obj;
    });
  }
}

export const metrics = new MetricsCounter();

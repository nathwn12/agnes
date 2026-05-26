import { describe, it, expect } from 'bun:test';
import { MetricsCounter } from './metrics.js';

describe('MetricsCounter', () => {
  it('increment increases count by 1', async () => {
    const m = new MetricsCounter();
    await m.increment('foo');
    expect(await m.get('foo')).toBe(1);
  });

  it('get returns 0 for unknown key', async () => {
    const m = new MetricsCounter();
    expect(await m.get('nonexistent')).toBe(0);
  });

  it('snapshot returns all keys', async () => {
    const m = new MetricsCounter();
    await m.increment('a');
    await m.increment('b');
    await m.increment('a');
    const snap = await m.snapshot();
    expect(snap).toEqual({ a: 2, b: 1 });
  });

  it('reset clears all counters', async () => {
    const m = new MetricsCounter();
    await m.increment('x');
    await m.reset();
    expect(await m.get('x')).toBe(0);
  });

  it('concurrent increments sum correctly', async () => {
    const m = new MetricsCounter();
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push(m.increment('concurrent'));
    }
    await Promise.all(promises);
    expect(await m.get('concurrent')).toBe(100);
  });
});

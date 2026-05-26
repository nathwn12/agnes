import { describe, it, expect } from 'bun:test';
import { SimpleMutex, MutexTimeoutError } from './mutex.js';

describe('SimpleMutex', () => {
  it('acquire resolves immediately when no lock held', async () => {
    const m = new SimpleMutex();
    await m.acquire('test');
    m.release('test');
  });

  it('blocks concurrent access on same key', async () => {
    const m = new SimpleMutex();
    const events: string[] = [];

    await m.acquire('key');

    const second = (async () => {
      await m.acquire('key');
      events.push('second-acquired');
      m.release('key');
    })();

    await new Promise(r => setTimeout(r, 10));
    expect(events).toEqual([]);

    m.release('key');
    await new Promise(r => setTimeout(r, 10));
    expect(events).toEqual(['second-acquired']);
  });

  it('release unblocks queued waiter', async () => {
    const m = new SimpleMutex();
    let secondDone = false;

    await m.acquire('key');

    const p = m.acquire('key').then(() => {
      secondDone = true;
      m.release('key');
    });

    await new Promise(r => setTimeout(r, 10));
    expect(secondDone).toBe(false);

    m.release('key');
    await p;
    expect(secondDone).toBe(true);
  });

  it('timeout rejects with MutexTimeoutError', async () => {
    const m = new SimpleMutex();
    await m.acquire('hold');

    try {
      await m.acquire('hold', 50);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MutexTimeoutError);
      expect((err as MutexTimeoutError).message).toContain('hold');
    }
  });

  it('can re-acquire after timeout', async () => {
    const m = new SimpleMutex();
    await m.acquire('hold');

    try {
      await m.acquire('hold', 50);
    } catch {
      // expected timeout
    }

    await m.acquire('hold', 100);
    m.release('hold');
  });

  it('sequential acquire after release', async () => {
    const m = new SimpleMutex();
    await m.acquire('key');
    m.release('key');

    await m.acquire('key');
    m.release('key');
  });
});

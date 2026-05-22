import { describe, expect, test } from 'bun:test';
import { MiddlewareChain, applyMiddleware, defaultMiddlewareChain } from './middleware.js';
import type { WaveContext, MiddlewareHooks } from './middleware.js';
import type { TaskDescriptor } from './schema.js';

function createWaveContext(overrides: Partial<WaveContext> = {}): WaveContext {
  return {
    planId: 'plan-001',
    waveIndex: 1,
    tasks: [],
    state: {},
    ...overrides,
  };
}

describe('MiddlewareChain', () => {
  test('can create a chain', () => {
    const chain = new MiddlewareChain([]);
    expect(chain).toBeInstanceOf(MiddlewareChain);
  });

  test('preWave hooks are called in order', async () => {
    const order: number[] = [];
    const hooks: MiddlewareHooks[] = [
      {
        name: 'hook-1',
        beforeWave: async (ctx) => {
          order.push(1);
          return { ...ctx, state: { ...ctx.state, step: '1' } };
        },
      },
      {
        name: 'hook-2',
        beforeWave: async (ctx) => {
          order.push(2);
          return { ...ctx, state: { ...ctx.state, step: '2' } };
        },
      },
    ];
    const chain = new MiddlewareChain(hooks);
    const ctx = createWaveContext();
    const result = await chain.executeBeforeWave(ctx);
    expect(order).toEqual([1, 2]);
    expect(result.state).toEqual({ step: '2' });
  });

  test('postWave hooks are called in order', async () => {
    const order: number[] = [];
    const hooks: MiddlewareHooks[] = [
      {
        name: 'hook-1',
        afterWave: async (ctx) => {
          order.push(1);
          return ctx;
        },
      },
      {
        name: 'hook-2',
        afterWave: async (ctx) => {
          order.push(2);
          return ctx;
        },
      },
    ];
    const chain = new MiddlewareChain(hooks);
    const ctx = createWaveContext();
    await chain.executeAfterWave(ctx, []);
    expect(order).toEqual([1, 2]);
  });

  test('onError hook catches errors from hooks', async () => {
    const errorHook: MiddlewareHooks = {
      name: 'error-logger',
      afterWave: async (ctx, results) => {
        const hasError = results.some((r) => r.status === 'BLOCKED' || r.status === 'NEEDS_CONTEXT');
        if (hasError) {
          return { ...ctx, state: { ...ctx.state, errorsDetected: true } };
        }
        return ctx;
      },
    };
    const chain = new MiddlewareChain([errorHook]);
    const ctx = createWaveContext();
    const results = [
      {
        type: 'result' as const,
        id: 'msg-1',
        timestamp: new Date().toISOString(),
        taskId: 'task-1',
        status: 'BLOCKED' as const,
        content: 'failed',
      },
    ];
    const result = await chain.executeAfterWave(ctx, results);
    expect(result.state.errorsDetected).toBe(true);
  });

  test('chain continues after non-blocking hook errors', async () => {
    const order: number[] = [];
    const hooks: MiddlewareHooks[] = [
      {
        name: 'failing-hook',
        beforeWave: async () => {
          order.push(1);
          throw new Error('hook error');
        },
      },
      {
        name: 'second-hook',
        beforeWave: async (ctx) => {
          order.push(2);
          return ctx;
        },
      },
    ];
    const chain = new MiddlewareChain(hooks);
    const ctx = createWaveContext();
    await expect(chain.executeBeforeWave(ctx)).rejects.toThrow('hook error');
    expect(order).toEqual([1]);
  });

  test('default exported middleware chain has hooks', () => {
    expect(defaultMiddlewareChain).toBeInstanceOf(MiddlewareChain);
  });

  test('executeSubagent runs beforeSubagent and afterSubagent hooks', async () => {
    const order: string[] = [];
    const hooks: MiddlewareHooks[] = [
      {
        name: 'test-hook',
        beforeSubagent: async (ctx) => {
          order.push('before');
          return ctx;
        },
        afterSubagent: async (ctx, result) => {
          order.push('after');
          return result;
        },
      },
    ];
    const chain = new MiddlewareChain(hooks);
    const task: TaskDescriptor = { skill: 'test', payload: {} };
    const ctx = { task, wave: createWaveContext() };
    const handler = async () => ({
      type: 'result' as const,
      id: 'msg-1',
      timestamp: new Date().toISOString(),
      taskId: 'task-1',
      status: 'DONE' as const,
      content: 'done',
    });
    const result = await chain.executeSubagent(ctx, handler);
    expect(order).toEqual(['before', 'after']);
    expect(result.content).toBe('done');
  });

  test('executeSubagent composes wrapSubagent handlers in order', async () => {
    const order: string[] = [];
    const hooks: MiddlewareHooks[] = [
      {
        name: 'outer',
        wrapSubagent: async (ctx, next) => {
          order.push('outer-before');
          const result = await next(ctx);
          order.push('outer-after');
          return result;
        },
      },
      {
        name: 'inner',
        wrapSubagent: async (ctx, next) => {
          order.push('inner-before');
          const result = await next(ctx);
          order.push('inner-after');
          return result;
        },
      },
    ];
    const chain = new MiddlewareChain(hooks);
    const task: TaskDescriptor = { skill: 'test', payload: {} };
    const ctx = { task, wave: createWaveContext() };
    const handler = async () => ({
      type: 'result' as const,
      id: 'msg-1',
      timestamp: new Date().toISOString(),
      taskId: 'task-1',
      status: 'DONE' as const,
      content: 'done',
    });
    await chain.executeSubagent(ctx, handler);
    expect(order).toEqual(['outer-before', 'inner-before', 'inner-after', 'outer-after']);
  });
});

describe('applyMiddleware', () => {
  test('runs hooks and returns result', async () => {
    const order: number[] = [];
    const hooks: MiddlewareHooks[] = [
      {
        name: 'tracker',
        beforeWave: async (ctx) => {
          order.push(1);
          return ctx;
        },
        afterWave: async (ctx) => {
          order.push(3);
          return ctx;
        },
      },
    ];
    const chain = new MiddlewareChain(hooks);
    const ctx = createWaveContext();
    const fn = async (c: WaveContext) => {
      order.push(2);
      return c.planId;
    };
    const result = await applyMiddleware(ctx, chain, fn);
    expect(order).toEqual([1, 2, 3]);
    expect(result).toBe('plan-001');
  });

  test('calls afterWave on error', async () => {
    const afterCalled: boolean[] = [];
    const hooks: MiddlewareHooks[] = [
      {
        name: 'error-logger',
        afterWave: async (ctx) => {
          afterCalled.push(true);
          return ctx;
        },
      },
    ];
    const chain = new MiddlewareChain(hooks);
    const ctx = createWaveContext();
    const fn = async () => {
      throw new Error('fn error');
    };
    await expect(applyMiddleware(ctx, chain, fn)).rejects.toThrow('fn error');
    expect(afterCalled).toEqual([true]);
  });
});

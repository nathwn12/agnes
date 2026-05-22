import type { TaskDescriptor } from './schema.js';
import type { ResultMessage } from './protocol.js';

export interface WaveContext {
  planId: string;
  waveIndex: number;
  tasks: TaskDescriptor[];
  state: Record<string, unknown>;
}

export interface SubagentContext {
  task: TaskDescriptor;
  wave: WaveContext;
}

export interface MiddlewareHooks {
  name: string;
  beforeWave?: (ctx: WaveContext) => WaveContext | Promise<WaveContext>;
  afterWave?: (ctx: WaveContext, results: ResultMessage[]) => WaveContext | Promise<WaveContext>;
  beforeSubagent?: (ctx: SubagentContext) => SubagentContext | Promise<SubagentContext>;
  afterSubagent?: (ctx: SubagentContext, result: ResultMessage) => ResultMessage | Promise<ResultMessage>;
  wrapSubagent?: (ctx: SubagentContext, handler: (ctx: SubagentContext) => Promise<ResultMessage>) => Promise<ResultMessage>;
}

export class MiddlewareChain {
  private hooks: MiddlewareHooks[];

  constructor(hooks: MiddlewareHooks[]) {
    this.hooks = hooks;
  }

  /** Chain all beforeWave hooks sequentially. Each receives the result of the previous. */
  async executeBeforeWave(ctx: WaveContext): Promise<WaveContext> {
    let current = ctx;
    for (const hook of this.hooks) {
      if (hook.beforeWave) {
        current = await hook.beforeWave(current);
      }
    }
    return current;
  }

  /** Chain all afterWave hooks sequentially. */
  async executeAfterWave(ctx: WaveContext, results: ResultMessage[]): Promise<WaveContext> {
    let current = ctx;
    for (const hook of this.hooks) {
      if (hook.afterWave) {
        current = await hook.afterWave(current, results);
      }
    }
    return current;
  }

  /** Compose wrapSubagent handlers: outer(inner(innermost(handler))).
   *  Each middleware can intercept, modify, retry, or short-circuit.
   *  Hooks without wrapSubagent are skipped.
   */
  async executeSubagent(
    ctx: SubagentContext,
    handler: (ctx: SubagentContext) => Promise<ResultMessage>,
  ): Promise<ResultMessage> {
    // Build the composed handler chain: middleware[N].wrapSubagent(middleware[N-1].wrapSubagent(...handler))
    let composed = handler;
    // Iterate in reverse so the first hook wraps the outermost
    for (let i = this.hooks.length - 1; i >= 0; i--) {
      const hook = this.hooks[i];
      if (hook.wrapSubagent) {
        const prev = composed;
        composed = (c: SubagentContext) => hook.wrapSubagent!(c, prev);
      }
    }

    // Run beforeSubagent hooks (sequential, mutating context)
    let current = ctx;
    for (const hook of this.hooks) {
      if (hook.beforeSubagent) {
        current = await hook.beforeSubagent(current);
      }
    }

    // Execute the composed handler
    let result = await composed(current);

    // Run afterSubagent hooks (sequential)
    for (const hook of this.hooks) {
      if (hook.afterSubagent) {
        result = await hook.afterSubagent(current, result);
      }
    }

    return result;
  }
}

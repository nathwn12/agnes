export type JumpTarget = 'retry' | 'skip' | 'blocked' | 'next_wave' | 'end';

export interface WaveSignal {
  jumpTo: JumpTarget | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export class FlowController {
  private signal: WaveSignal;

  constructor() {
    this.signal = { jumpTo: null };
  }

  setJump(target: JumpTarget, reason?: string, metadata?: Record<string, unknown>): void {
    this.signal = { jumpTo: target, reason, metadata };
  }

  /** Consume and return the full signal (reason + metadata included). Single authoritative destructive reader. */
  consumeSignal(): WaveSignal {
    const sig = this.signal;
    this.signal = { jumpTo: null };
    return sig;
  }

  /** Convenience: extract only the jump target from the signal. Delegates to consumeSignal. */
  getJump(): JumpTarget | null {
    return this.consumeSignal().jumpTo;
  }

  /** Peek at current signal without consuming. Read-only. */
  private peek(): JumpTarget | null {
    return this.signal.jumpTo;
  }

  isBlocked(): boolean {
    return this.peek() === 'blocked';
  }

  shouldSkip(): boolean {
    return this.peek() === 'skip';
  }

  shouldRetry(): boolean {
    return this.peek() === 'retry';
  }

  clearSignal(): void {
    this.consumeSignal();
  }
}

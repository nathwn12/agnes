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

  /** Non-destructive: returns current jump target without consuming the signal. */
  getJump(): JumpTarget | null {
    return this.signal.jumpTo;
  }

  /** Non-destructive: returns a copy of the full signal (reason + metadata) without consuming. */
  peekSignal(): WaveSignal {
    return { ...this.signal };
  }

  isBlocked(): boolean {
    return this.peekSignal().jumpTo === 'blocked';
  }

  shouldSkip(): boolean {
    return this.peekSignal().jumpTo === 'skip';
  }

  shouldRetry(): boolean {
    return this.peekSignal().jumpTo === 'retry';
  }

  clearSignal(): void {
    this.consumeSignal();
  }
}

export function createFlowController(initialTarget?: JumpTarget, reason?: string): FlowController {
  const controller = new FlowController();
  if (initialTarget) {
    controller.setJump(initialTarget, reason);
  }
  return controller;
}


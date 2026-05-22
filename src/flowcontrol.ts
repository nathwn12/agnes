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

  setJump(target: JumpTarget, reason?: string): void {
    this.signal = { jumpTo: target, reason };
  }

  getJump(): JumpTarget | null {
    const target = this.signal.jumpTo;
    this.signal = { jumpTo: null };
    return target;
  }

  consumeSignal(): WaveSignal {
    const sig = { ...this.signal };
    this.signal = { jumpTo: null };
    return sig;
  }

  isBlocked(): boolean {
    return this.signal.jumpTo === 'blocked';
  }

  shouldSkip(): boolean {
    return this.signal.jumpTo === 'skip';
  }

  shouldRetry(): boolean {
    return this.signal.jumpTo === 'retry';
  }

  clearSignal(): void {
    this.signal = { jumpTo: null };
  }
}

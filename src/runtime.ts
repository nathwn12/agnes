import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findPackageRoot(fromDir: string): string | null {
  let current = fromDir;
  for (let i = 0; i < 10; i++) {
    const pj = path.join(current, 'package.json');
    if (fs.existsSync(pj)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pj, 'utf8')) as { name?: string };
        if (pkg.name === 'agnes') return current;
      } catch { }
    }
    const parent = path.resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return null;
}

const PACKAGE_ROOT = findPackageRoot(path.resolve(__dirname, '..', '..')) ?? findPackageRoot(__dirname) ?? path.resolve(__dirname, '..', '..');

export const AGNES_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version?: string };
    return pkg.version || 'unknown';
  } catch { return 'unknown'; }
})();

export function getVersion(): string {
  return AGNES_VERSION;
}

export function getIdentityLine(): string {
  return `AGNES v${AGNES_VERSION}`;
}

export type ModelTier = 'small' | 'medium' | 'large';

export const MAX_DELEGATE_DEPTH = 2;

let _detectedTier: ModelTier | null = null;

export function detectModelTier(): ModelTier {
  if (_detectedTier) return _detectedTier;
  const env = process.env.AGNES_MODEL_TIER?.toLowerCase();
  if (env === 'small' || env === 'medium' || env === 'large') return env;
  return 'large';
}

export function setModelId(modelID: string): void {
  if (_detectedTier) return;

  const env = process.env.AGNES_MODEL_TIER?.toLowerCase();
  if (env === 'small' || env === 'medium' || env === 'large') return;

  const id = modelID.toLowerCase();

  // DeepSeek models always get large tier (1M context, frontier capability)
  if (/deepseek/.test(id)) { _detectedTier = 'large'; return; }

  // Strategy 0: provider prefix — Go and Zen are always frontier/large
  if (/^opencode(-go)?\//.test(id)) { _detectedTier = 'large'; return; }

  // Strategy 1: direct param count in model ID
  const paramMatch = id.match(/(\d{1,3})b/);
  if (paramMatch) {
    const params = parseInt(paramMatch[1], 10);
    if (params <= 13) { _detectedTier = 'small'; return; }
    if (params <= 60) { _detectedTier = 'medium'; return; }
    _detectedTier = 'large'; return;
  }

  // Strategy 2: keyword-based
  if (/\b(mini|nano|tiny)\b/.test(id)) { _detectedTier = 'small'; return; }
  // Flash/lite/haiku for non-DeepSeek models → medium
  if (/\b(flash|haiku|spark|lite)\b/.test(id)) { _detectedTier = 'medium'; return; }

  _detectedTier = 'large';
}

export function getMaxConcurrency(tier: ModelTier): number {
  switch (tier) {
    case 'small': return 3;
    case 'medium': return 5;
    case 'large': return 10;
  }
}

export function getMaxResultChars(tier: ModelTier): number {
  switch (tier) {
    case 'small': return 2000;
    case 'medium': return 4000;
    case 'large': return 8000;
  }
}

export function truncateResult(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n[...truncated, ${text.length - maxChars} chars omitted]`;
}

let _yoloMode = false;

export function setYoloMode(v: boolean): void {
  _yoloMode = v;
}

export function isYoloMode(): boolean {
  return _yoloMode;
}

// ── Gate skip ────────────────────────────────────────────────────────────────────

export function getGateSkip(): boolean {
  const val = process.env.AGNES_SKIP_GATE?.toLowerCase();
  return val === '1' || val === 'true' || val === 'yes';
}

// ── Instance ID ──────────────────────────────────────────────────────────────────

const _instanceId = `agnes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function getInstanceId(): string {
  return _instanceId;
}

// ── Async error ring buffer ──────────────────────────────────────────────────────

export interface AsyncError {
  timestamp: string;
  sessionId: string;
  error: string;
  stack?: string;
}

const MAX_ASYNC_ERRORS = 10;
const _asyncErrors: AsyncError[] = [];

export function pushError(sessionId: string, error: string, stack?: string): void {
  _asyncErrors.push({ timestamp: new Date().toISOString(), sessionId, error, stack });
  if (_asyncErrors.length > MAX_ASYNC_ERRORS) _asyncErrors.shift();
}

export function getAsyncErrors(): AsyncError[] {
  return [..._asyncErrors];
}

export function clearAsyncErrors(): void {
  _asyncErrors.length = 0;
}

export class Semaphore {
  private _current = 0;
  private _queue: (() => void)[] = [];

  constructor(private _max: number) {}

  async acquire(): Promise<void> {
    if (this._current < this._max) {
      this._current++;
      return;
    }
    return new Promise<void>(resolve => {
      this._queue.push(() => {
        this._current++;
        resolve();
      });
    });
  }

  release(): void {
    const next = this._queue.shift();
    if (next) {
      next();
    } else {
      if (this._current > 0) this._current--;
    }
  }

  get active(): number {
    return this._current;
  }

  get queued(): number {
    return this._queue.length;
  }
}

let _semaphore: Semaphore | null = null;

export function getSemaphore(): Semaphore {
  if (!_semaphore) {
    _semaphore = new Semaphore(getMaxConcurrency(detectModelTier()));
  }
  return _semaphore;
}

let _autoDelegateSemaphore: Semaphore | null = null;

export function getAutoDelegateSemaphore(): Semaphore {
  if (!_autoDelegateSemaphore) {
    _autoDelegateSemaphore = new Semaphore(3); // Fixed at 3 — auto-delegation is a fallback, not primary path
  }
  return _autoDelegateSemaphore;
}



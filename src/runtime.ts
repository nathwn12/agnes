// ── Model tier detection ──────────────────────────────────────────────────────

export type ModelTier = 'small' | 'medium' | 'large';

export function detectModelTier(): ModelTier {
  const env = process.env.AGNES_MODEL_TIER?.toLowerCase();
  if (env === 'small' || env === 'medium' || env === 'large') return env;
  return 'medium';
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

// ── Context budget: truncate large tool results ───────────────────────────────

export function truncateResult(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n[...truncated, ${text.length - maxChars} chars omitted]`;
}

// ── YOLO mode ────────────────────────────────────────────────────────────────

let _yoloMode = false;

export function setYoloMode(v: boolean): void {
  _yoloMode = v;
}

export function isYoloMode(): boolean {
  return _yoloMode;
}

export type ModelTier = 'small' | 'medium' | 'large';

let _detectedTier: ModelTier | null = null;

const SMALL_PATTERN = /\b\d{1,2}b\b/i; // matches 3b, 7b, 12b, etc.
const MEDIUM_PATTERN = /\b(1[4-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])b\b/i; // 14b-59b

export function detectModelTier(): ModelTier {
  if (_detectedTier) return _detectedTier;
  const env = process.env.AGNES_MODEL_TIER?.toLowerCase();
  if (env === 'small' || env === 'medium' || env === 'large') return env;
  return 'medium';
}

export function setModelId(modelID: string): void {
  const env = process.env.AGNES_MODEL_TIER?.toLowerCase();
  if (env === 'small' || env === 'medium' || env === 'large') return;

  if (SMALL_PATTERN.test(modelID)) {
    _detectedTier = 'small';
  } else if (MEDIUM_PATTERN.test(modelID)) {
    _detectedTier = 'medium';
  } else {
    _detectedTier = 'large';
  }
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

export type ModelTier = 'small' | 'medium' | 'large';

let _detectedTier: ModelTier | null = null;

export function detectModelTier(): ModelTier {
  if (_detectedTier) return _detectedTier;
  const env = process.env.AGNES_MODEL_TIER?.toLowerCase();
  if (env === 'small' || env === 'medium' || env === 'large') return env;
  return 'medium';
}

export function setModelId(modelID: string): void {
  // Env var always wins
  const env = process.env.AGNES_MODEL_TIER?.toLowerCase();
  if (env === 'small' || env === 'medium' || env === 'large') return;

  const id = modelID.toLowerCase();

  // Strategy 0: provider prefix — Go and Zen are always frontier/large
  if (/^opencode(-go)?\//.test(id)) { _detectedTier = 'large'; return; }

  // Strategy 1: direct param count in model ID (e.g. llama-3.2-3b, qwen-2.5-coder-14b, deepseek-v2-236b)
  const paramMatch = id.match(/(\d{1,3})b/);
  if (paramMatch) {
    const params = parseInt(paramMatch[1], 10);
    if (params <= 13) { _detectedTier = 'small'; return; }
    if (params <= 60) { _detectedTier = 'medium'; return; }
    _detectedTier = 'large'; return;
  }

  // Strategy 2: keyword-based for models without explicit param count
  // Small-tier keywords: mini, nano, tiny, small
  if (/\b(mini|nano|tiny)\b/.test(id)) { _detectedTier = 'small'; return; }
  // Medium-tier keywords: flash, haiku, spark, lite (fast/lightweight variants)
  if (/\b(flash|haiku|spark|lite)\b/.test(id)) { _detectedTier = 'medium'; return; }

  // Default: large — applies to any unrecognized model IDs
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

import { stringify as yamlStringify } from 'yaml';

import type { StruggleMetrics } from './state.js';

export const DEFAULT_COMPACTION_SOFT_LIMIT = 150_000;
export const DEFAULT_COMPACTION_HARD_LIMIT = 200_000;
const DEFAULT_DISCRETIONARY_COMPACTION_FLOOR = 50_000;

export type CompactionAction = 'none' | 'nudge' | 'alert' | 'compact';

export interface CompactionPolicyState {
  tokenCount: number;
  softLimit: number;
  hardLimit: number;
  lastAction: CompactionAction;
  lastReason: string | null;
  lastTriggeredAt: string | null;
}

export interface CompactionDecision {
  action: CompactionAction;
  reason: string;
  state: CompactionPolicyState;
  advisory: string;
}

export interface MessagePartLike {
  type?: string;
  text?: string;
}

export interface MessageLike {
  info?: { role?: string };
  parts?: MessagePartLike[];
}

type CompactionCacheEntry = {
  state: CompactionPolicyState;
  lastAccessed: number;
};

const compactionStates = new Map<string, CompactionCacheEntry>();
const COMPACTION_STATE_TTL_MS = 60 * 60 * 1000;
const MAX_COMPACTION_STATES = 200;

function formatTokens(value: number): string {
  return value.toLocaleString('en-US');
}

function countRepeatedStruggleErrors(struggle?: StruggleMetrics | null): number {
  if (!struggle) return 0;
  return Object.values(struggle.repeatedErrors).filter((count) => count >= 2).length;
}

function hasDiscretionaryStruggle(struggle?: StruggleMetrics | null): boolean {
  if (!struggle) return false;
  return (
    struggle.noProgressIterations >= 3 || struggle.shortIterations >= 3 || countRepeatedStruggleErrors(struggle) > 0
  );
}

function pruneCompactionStates(): void {
  const now = Date.now();
  for (const [sessionID, entry] of compactionStates) {
    if (now - entry.lastAccessed > COMPACTION_STATE_TTL_MS) {
      compactionStates.delete(sessionID);
    }
  }

  if (compactionStates.size <= MAX_COMPACTION_STATES) return;

  const overflow = [...compactionStates.entries()]
    .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
    .slice(0, compactionStates.size - MAX_COMPACTION_STATES);

  for (const [sessionID] of overflow) {
    compactionStates.delete(sessionID);
  }
}

export function estimatePromptTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export function collectMessageText(messages: MessageLike[]): string {
  const chunks: string[] = [];
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type !== 'text' || typeof part.text !== 'string') continue;
      const text = part.text.trim();
      if (text.length > 0) chunks.push(text);
    }
  }
  return chunks.join('\n');
}

export function evaluateCompactionPolicy(input: {
  sessionID: string;
  promptText: string;
  struggle?: StruggleMetrics | null;
  now?: string;
  softLimit?: number;
  hardLimit?: number;
  discretionaryFloor?: number;
}): CompactionDecision {
  const softLimit = input.softLimit ?? DEFAULT_COMPACTION_SOFT_LIMIT;
  const hardLimit = input.hardLimit ?? DEFAULT_COMPACTION_HARD_LIMIT;
  const tokenCount = estimatePromptTokens(input.promptText);
  const previous = compactionStates.get(input.sessionID) ?? null;
  const now = input.now ?? new Date().toISOString();

  let action: CompactionAction = 'none';
  let reason = 'Approximate context is within budget.';

  const discretionaryFloor = input.discretionaryFloor ?? DEFAULT_DISCRETIONARY_COMPACTION_FLOOR;

  if (tokenCount >= hardLimit) {
    action = 'alert';
    reason = `Approximate context is ${formatTokens(tokenCount)} tokens, at or above the ${formatTokens(hardLimit)} token hard limit.`;
  } else if (hasDiscretionaryStruggle(input.struggle) && tokenCount >= discretionaryFloor) {
    action = 'compact';
    reason = `Context is stale or bloated and the session is struggling; approximate load is ${formatTokens(tokenCount)} tokens.`;
  } else if (tokenCount >= softLimit) {
    action = 'nudge';
    reason = `Approximate context is ${formatTokens(tokenCount)} tokens, approaching the ${formatTokens(softLimit)} token soft limit.`;
  }

  const state: CompactionPolicyState = {
    tokenCount,
    softLimit,
    hardLimit,
    lastAction: action,
    lastReason: action === 'none' ? null : reason,
    lastTriggeredAt: action === 'none' ? (previous?.state.lastTriggeredAt ?? null) : now,
  };

  return {
    action,
    reason,
    state,
    advisory: buildCompactionAdvisory(action, reason),
  };
}

export function rememberCompactionState(sessionID: string, state: CompactionPolicyState): CompactionPolicyState {
  pruneCompactionStates();
  compactionStates.set(sessionID, {
    state,
    lastAccessed: Date.now(),
  });
  return state;
}

export function getCompactionState(sessionID: string): CompactionPolicyState | null {
  const entry = compactionStates.get(sessionID);
  if (!entry) return null;
  entry.lastAccessed = Date.now();
  return entry.state;
}

export function buildCompactionAdvisory(action: CompactionAction, reason: string): string {
  if (action === 'none') return '';

  if (action === 'compact') {
    return [
      '## Compaction Recommended',
      reason,
      'Compact now and preserve the active plan, recent decisions, and unresolved blockers.',
    ].join('\n');
  }

  if (action === 'alert') {
    return ['## Compaction Required', reason, 'Use `/compact` or `/summarize` now before adding more work.'].join('\n');
  }

  return [
    '## Compaction Advisory',
    reason,
    'You are approaching the compaction threshold. Use `/compact` or `/summarize` soon.',
  ].join('\n');
}

export function buildCompactionContext(state: CompactionPolicyState): string {
  const lines = [
    `Approximate prompt load: ${formatTokens(state.tokenCount)} tokens`,
    `Soft limit: ${formatTokens(state.softLimit)} tokens`,
    `Hard limit: ${formatTokens(state.hardLimit)} tokens`,
    `Last policy action: ${state.lastAction}`,
  ];

  if (state.lastReason) {
    lines.push(`Last policy reason: ${state.lastReason}`);
  }
  if (state.lastTriggeredAt) {
    lines.push(`Last trigger time: ${state.lastTriggeredAt}`);
  }

  return lines.join('\n');
}

export function buildCompactionBlock(state: CompactionPolicyState): string {
  return `<structured type="compaction">\n${yamlStringify({
    type: 'compaction',
    token_count: state.tokenCount,
    soft_limit: state.softLimit,
    hard_limit: state.hardLimit,
    last_action: state.lastAction,
    last_reason: state.lastReason,
    last_triggered_at: state.lastTriggeredAt,
  })}</structured>`;
}

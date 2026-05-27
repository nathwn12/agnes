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
  attractors?: Attractor[];
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

  let attractors: Attractor[] = previous?.state.attractors || [];
  if (tokenCount > 1000) {
    const fragments = input.promptText.split(/[.?!]\s+/).filter(f => f.trim().length > 20);
    attractors = updateAttractors(attractors, fragments);
  }

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
    attractors: attractors.length > 0 ? attractors : undefined,
  };

  return {
    action,
    reason,
    state,
    advisory: buildCompactionAdvisory(action, reason, attractors.length > 0 ? attractors : undefined),
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

export function buildCompactionAdvisory(action: CompactionAction, reason: string, attractors?: Attractor[]): string {
  if (action === 'none') return '';

  let residueLine = '';
  if (attractors && attractors.length > 0) {
    const top = attractors.slice(0, 3).map(a => a.label).join(', ');
    residueLine = `\nActive concepts: ${top}`;
  }

  if (action === 'compact') {
    return [
      '## Compaction Recommended',
      reason + residueLine,
      'Compact now and preserve the active plan, recent decisions, and unresolved blockers.',
    ].join('\n');
  }

  if (action === 'alert') {
    return ['## Compaction Required', reason + residueLine, 'Use `/compact` or `/summarize` now before adding more work.'].join('\n');
  }

  return [
    '## Compaction Advisory',
    reason + residueLine,
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
  const top = state.attractors?.slice(0, 5).map(a => ({
    label: a.label,
    strength: Number(a.strength.toFixed(2)),
  }));
  return `<structured type="compaction">\n${yamlStringify({
    type: 'compaction',
    token_count: state.tokenCount,
    soft_limit: state.softLimit,
    hard_limit: state.hardLimit,
    last_action: state.lastAction,
    last_reason: state.lastReason,
    last_triggered_at: state.lastTriggeredAt,
    ...(top && top.length > 0 ? { attractors: top } : {}),
  })}</structured>`;
}

// ── Semantic Attractors & Symbolic Residue ──────────────────────────────────

export interface Attractor {
  id: string;
  label: string;
  strength: number;
  lastReinforced: number;
  evidence: string[];
}

export interface SymbolicResidue {
  attractors: Attractor[];
  decisions: string[];
  blockers: string[];
  activeContext: string;
}

export function buildResidueSummary(residue: SymbolicResidue): string {
  const parts: string[] = [];

  if (residue.attractors.length > 0) {
    const top = residue.attractors
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5)
      .map(a => `${a.label} (strength:${a.strength.toFixed(2)})`);
    parts.push(`Active attractors: ${top.join(', ')}`);
  }

  if (residue.decisions.length > 0) {
    parts.push(`Decisions: ${residue.decisions.join('; ')}`);
  }

  if (residue.blockers.length > 0) {
    parts.push(`Blockers: ${residue.blockers.join('; ')}`);
  }

  if (residue.activeContext) {
    parts.push(`Context: ${residue.activeContext}`);
  }

  return parts.join(' | ');
}

export function updateAttractors(
  existing: Attractor[],
  newFragments: string[],
  decayFactor: number = 0.9,
): Attractor[] {
  const now = Date.now();
  const merged = new Map<string, Attractor>();

  for (const a of existing) {
    merged.set(a.id, {
      ...a,
      strength: a.strength * decayFactor,
    });
  }

  const conceptRe = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g;
  for (const frag of newFragments) {
    const concepts = frag.match(conceptRe) || [];
    for (const concept of concepts) {
      const existingAttractor = merged.get(concept);
      if (existingAttractor) {
        existingAttractor.strength = Math.min(1, existingAttractor.strength + 0.2);
        existingAttractor.lastReinforced = now;
        existingAttractor.evidence.push(frag.slice(0, 100));
      } else {
        merged.set(concept, {
          id: concept,
          label: concept,
          strength: 0.5,
          lastReinforced: now,
          evidence: [frag.slice(0, 100)],
        });
      }
    }
  }

  const pruned = Array.from(merged.values())
    .filter(a => a.strength > 0.1)
    .sort((a, b) => b.strength - a.strength);

  return pruned;
}

export function extractResidue(
  messages: MessageLike[],
  existingAttractors: Attractor[],
  knownDecisions?: string[],
  knownBlockers?: string[],
): SymbolicResidue {
  const text = collectMessageText(messages);
  const fragments = text.split(/[.?!]\s+/).filter(f => f.trim().length > 20);

  return {
    attractors: updateAttractors(existingAttractors, fragments),
    decisions: knownDecisions || [],
    blockers: knownBlockers || [],
    activeContext: text.split('\n').slice(-5).join(' ').slice(0, 300),
  };
}

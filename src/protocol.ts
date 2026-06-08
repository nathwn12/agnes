import { validateMessage } from './schema.js';
import type { AnyAgnesMessage, CompletionStatus, MessageType } from './schema.js';

// ── Key mapping for compact serialization ─────────────────────────────────────

const LONG_TO_SHORT: Record<string, string> = {
  type: 't',
  id: 'i',
  timestamp: 'ts',
  status: 's',
  content: 'c',
  summary: 'm',
  taskId: 'tid',
  errorType: 'et',
  detail: 'd',
  stack: 'st',
  phase: 'ph',
  progress: 'pg',
  skill: 'sk',
  payload: 'pl',
  goal: 'g',
  files: 'f',
  constraints: 'cn',
  config: 'cfg',
  artifact: 'a',
  reasoning_content: 'rc',
};

const SHORT_TO_LONG: Record<string, string> = {};
for (const [long, short] of Object.entries(LONG_TO_SHORT)) {
  SHORT_TO_LONG[short] = long;
}

function keysToShort(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[LONG_TO_SHORT[k] ?? k] = v;
  }
  return out;
}

function keysToLong(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[SHORT_TO_LONG[k] ?? k] = v;
  }
  return out;
}

// ── Envelope format ───────────────────────────────────────────────────────────

const MAGIC_PREFIX = '\xA7AM';
const MAGIC_PREFIX_LEN = MAGIC_PREFIX.length;

const OLD_ENVELOPE_START = '<!-- <agnes:message>';
const OLD_ENVELOPE_END = '</agnes:message> -->';
const OLD_SIMPLE_START = '<agnes:message>';
const OLD_SIMPLE_END = '</agnes:message>';

// ── Low-level helpers ─────────────────────────────────────────────────────────

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceStart = trimmed.match(/^```(?:json)?\s*\n/);
  const fenceEnd = trimmed.match(/\n```\s*$/);
  if (fenceStart && fenceEnd) {
    return trimmed.slice(fenceStart[0].length, -fenceEnd[0].length).trim();
  }
  return trimmed;
}

function findJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) return trimmed.slice(firstBrace, i + 1);
    }
  }
  return null;
}

// ── Parse ─────────────────────────────────────────────────────────────────────

export function parseAgnesMessage(text: string): AnyAgnesMessage | null {
  const cleaned = stripCodeFences(text);

  // Try new format: §AM{...}
  if (cleaned.startsWith(MAGIC_PREFIX)) {
    const json = findJsonObject(cleaned.slice(MAGIC_PREFIX_LEN));
    if (!json) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    const expanded = keysToLong(parsed as Record<string, unknown>);
    return validateMessage(expanded);
  }

  // Try old format: <!-- <agnes:message>... --> or <agnes:message>...
  let jsonStr: string | null = null;
  const ci = cleaned.indexOf(OLD_ENVELOPE_START);
  if (ci !== -1) {
    const endIdx = cleaned.indexOf(OLD_ENVELOPE_END, ci);
    if (endIdx === -1) return null;
    jsonStr = cleaned.slice(ci + OLD_ENVELOPE_START.length, endIdx);
  } else {
    const si = cleaned.indexOf(OLD_SIMPLE_START);
    if (si !== -1) {
      const endIdx = cleaned.indexOf(OLD_SIMPLE_END, si);
      if (endIdx === -1) return null;
      jsonStr = cleaned.slice(si + OLD_SIMPLE_START.length, endIdx);
    }
  }

  if (jsonStr) {
    let parsed: unknown;
    try { parsed = JSON.parse(jsonStr); } catch { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    return validateMessage(parsed);
  }

  // Fallback: find any JSON object in text
  const fallbackJson = findJsonObject(cleaned);
  if (!fallbackJson) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(fallbackJson); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  return validateMessage(parsed);
}

export function isValidAgnesMessage(obj: unknown): obj is AnyAgnesMessage {
  return validateMessage(obj) !== null;
}

// ── Serialize ─────────────────────────────────────────────────────────────────

let _msgCounter = 0;

export function serializeAgnesMessage(msg: object): string {
  const m = msg as Record<string, unknown>;
  const id = m.id ?? `m${++_msgCounter}`;

  let type: MessageType = 'task';
  if (typeof m.type === 'string' && ['task', 'result', 'error', 'status', 'completion'].includes(m.type)) {
    type = m.type as MessageType;
  }

  const compact = keysToShort({
    ...m,
    type,
    id,
    timestamp: m.timestamp ?? new Date().toISOString(),
  });

  return `${MAGIC_PREFIX}${JSON.stringify(compact)}`;
}

export function buildResultMessage(params: {
  taskId: string;
  status: CompletionStatus;
  content: string;
  artifact?: unknown;
  reasoning?: string;
}): string {
  const obj: Record<string, unknown> = {
    type: 'result',
    taskId: params.taskId,
    status: params.status,
    content: params.content,
  };
  if (params.artifact !== undefined) obj.artifact = params.artifact;
  if (params.reasoning !== undefined) obj.reasoning_content = params.reasoning;
  return serializeAgnesMessage(obj);
}

export function buildTaskMessage(params: {
  skill: string;
  payload: unknown;
  config?: {
    tags?: string[];
    metadata?: Record<string, unknown>;
    maxDurationMs?: number;
  };
}): string {
  const obj: Record<string, unknown> = {
    type: 'task',
    skill: params.skill,
    payload: params.payload,
  };
  if (params.config !== undefined) obj.config = params.config;
  return serializeAgnesMessage(obj);
}

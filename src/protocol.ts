import * as logger from './logger.js';

// ── Constants ───────────────────────────────────────────────────────────────────

const MAX_MESSAGE_DEPTH = 5;
const MAX_CONTENT_LEN_PREFIX = 2000;

// ── Envelope format ───────────────────────────────────────────────────────────

const MAGIC_PREFIX = '\xA7AM';
const MAGIC_PREFIX_LEN = MAGIC_PREFIX.length;
const MAGIC_LEN_PREFIX = '\xA7AMLEN';

const OLD_ENVELOPE_START = '<!-- <agnes:message>';
const OLD_ENVELOPE_END = '</agnes:message> -->';
const OLD_SIMPLE_START = '<agnes:message>';
const OLD_SIMPLE_END = '</agnes:message>';

// ── Types ───────────────────────────────────────────────────────────────────────

interface CompletionMessage {
  type: 'completion';
  taskID?: string;
  status?: string;
  content?: string;
  artifacts?: Record<string, unknown>;
}

interface ResultMessage {
  type: 'result';
  taskID?: string;
  status?: string;
  content?: string;
  artifacts?: Record<string, unknown>;
}

interface TaskMessage {
  type: 'task';
  taskID?: string;
  description?: string;
  agent?: string;
  files?: string[];
  dependsOn?: string[];
}

interface BatchMessage {
  type: 'batch';
  tasks?: TaskMessage[];
}

interface PhaseMessage {
  type: 'phase';
  phase?: string;
  index?: number;
  total?: number;
}

interface ProgressMessage {
  type: 'progress';
  taskID?: string;
  done?: number;
  total?: number;
}

interface RequestMessage {
  type: 'request';
  action?: string;
  target?: string;
  reason?: string;
}

interface ErrorMessage {
  type: 'error';
  code?: string;
  message?: string;
}

type AnyAgnesMessage = CompletionMessage | ResultMessage | TaskMessage | BatchMessage | PhaseMessage | ProgressMessage | RequestMessage | ErrorMessage;

// ── Short keys ──────────────────────────────────────────────────────────────────

const LONG_TO_SHORT: Record<string, string> = {
  taskID: 'i',
  description: 'd',
  agent: 'a',
  files: 'f',
  dependsOn: 'D',
  type: 't',
  status: 's',
  content: 'c',
  artifacts: 'r',
  phase: 'p',
  index: 'x',
  total: 'n',
  done: 'o',
  action: 'A',
  target: 'T',
  reason: 'R',
  error: 'e',
  code: 'C',
  message: 'm',
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
  let maxDepth = 0;

  for (let i = firstBrace; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') {
        depth++;
        if (depth > maxDepth) maxDepth = depth;
        if (maxDepth > MAX_MESSAGE_DEPTH) return null;
      }
      if (ch === '}') {
        depth--;
        if (depth === 0) return trimmed.slice(firstBrace, i + 1);
      }
    }
  }
  return null;
}

function handleContentLengthPrefix(text: string): string | null {
  if (!text.startsWith(MAGIC_LEN_PREFIX)) return text;
  const rest = text.slice(MAGIC_LEN_PREFIX.length);
  const colonIdx = rest.indexOf(':');
  if (colonIdx === -1) return null;
  const lenStr = rest.slice(0, colonIdx);
  const len = parseInt(lenStr, 10);
  if (isNaN(len) || len <= 0) return null;
  const payload = rest.slice(colonIdx + 1);
  if (payload.length !== len) {
    logger.warn(`Content-length prefix mismatch: declared ${len} but actual ${payload.length}`);
    return null;
  }
  return payload;
}

// ── Parse ─────────────────────────────────────────────────────────────────────

export function parseAgnesMessage(text: string): AnyAgnesMessage | null {
  try {
    const cleaned = stripCodeFences(text);

    // Handle content-length prefix
    const content = handleContentLengthPrefix(cleaned);
    if (content === null) return null;

    // Try new format: §AM{...}
    if (content.startsWith(MAGIC_PREFIX)) {
      const json = findJsonObject(content.slice(MAGIC_PREFIX_LEN));
      if (!json) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(json); } catch { return null; }
      if (!parsed || typeof parsed !== 'object') return null;
      const expanded = keysToLong(parsed as Record<string, unknown>);
      return validateMessage(expanded as Record<string, unknown>);
    }

    // Try old format: <!-- <agnes:message>... --> or <agnes:message>...
    let jsonStr: string | null = null;
    const ci = content.indexOf(OLD_ENVELOPE_START);
    if (ci !== -1) {
      const endIdx = content.indexOf(OLD_ENVELOPE_END, ci);
      if (endIdx === -1) return null;
      jsonStr = content.slice(ci + OLD_ENVELOPE_START.length, endIdx);
    } else {
      const si = content.indexOf(OLD_SIMPLE_START);
      if (si !== -1) {
        const endIdx = content.indexOf(OLD_SIMPLE_END, si);
        if (endIdx === -1) return null;
        jsonStr = content.slice(si + OLD_SIMPLE_START.length, endIdx);
      }
    }

    if (jsonStr) {
      let parsed: unknown;
      try { parsed = JSON.parse(jsonStr); } catch { return null; }
      if (!parsed || typeof parsed !== 'object') return null;
      return validateMessage(parsed as Record<string, unknown>);
    }

    // Fallback: find any JSON object in text
    const fallbackJson = findJsonObject(content);
    if (!fallbackJson) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(fallbackJson); } catch { return null; }
    if (!parsed || typeof parsed !== 'object') return null;

    return parsed as unknown as AnyAgnesMessage;
  } catch (err) {
    logger.warn('parseAgnesMessage failed', err);
    return null;
  }
}

// ── Validate ───────────────────────────────────────────────────────────────────

const VALID_TYPES = ['completion', 'result', 'task', 'batch', 'phase', 'progress', 'request', 'error'];
const VALID_STATUSES = ['DONE', 'BLOCKED'];

function validateMessage(msg: Record<string, unknown>): AnyAgnesMessage | null {
  if (!msg.type || typeof msg.type !== 'string') return null;
  if (!VALID_TYPES.includes(msg.type)) return null;
  if (msg.status && typeof msg.status === 'string' && !VALID_STATUSES.includes(msg.status)) return null;
  return msg as unknown as AnyAgnesMessage;
}

// ── Build ────────────────────────────────────────────────────────────────────────

export function buildCompletionMessage(
  taskID: string,
  content: string,
  artifacts?: Record<string, unknown>,
): string {
  const msg = { type: 'completion', taskID, status: 'DONE', content, artifacts } as Record<string, unknown>;
  const short = keysToShort(msg);
  return formatMessage(short);
}

export function buildResultMessage(
  taskID: string,
  content: string,
  artifacts?: Record<string, unknown>,
): string {
  const msg = { type: 'result', taskID, status: 'DONE', content, artifacts } as Record<string, unknown>;
  const short = keysToShort(msg);
  return formatMessage(short);
}

function formatMessage(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  const full = `${MAGIC_PREFIX}${json}`;
  if (full.length > MAX_CONTENT_LEN_PREFIX) {
    return `${MAGIC_LEN_PREFIX}${full.length}:${full}`;
  }
  return full;
}

import { randomUUID } from 'node:crypto';

export type MessageType = 'task' | 'result' | 'error' | 'status' | 'completion';
export type CompletionStatus = 'DONE' | 'DONE_WITH_CONCERNS' | 'NEEDS_CONTEXT' | 'BLOCKED';

interface AgnesMessage {
  type: MessageType;
  id: string;
  timestamp: string;
}

export interface TaskMessage extends AgnesMessage {
  type: 'task';
  skill: string;
  payload: unknown;
  config?: {
    tags?: string[];
    metadata?: Record<string, unknown>;
    maxDurationMs?: number;
  };
}

export interface ResultMessage extends AgnesMessage {
  type: 'result';
  taskId: string;
  status: CompletionStatus;
  content: string;
  artifact?: unknown;
  metrics?: {
    durationMs: number;
    filesChanged?: number;
    tokenCount?: number;
  };
}

export interface ErrorMessage extends AgnesMessage {
  type: 'error';
  taskId: string;
  errorType: string;
  detail: string;
  stack?: string;
}

export interface StatusMessage extends AgnesMessage {
  type: 'status';
  taskId: string;
  phase: string;
  progress?: { current: number; total: number };
}

export interface CompletionMessage extends AgnesMessage {
  type: 'completion';
  status: CompletionStatus;
  summary: string;
}

export type AnyAgnesMessage =
  | TaskMessage
  | ResultMessage
  | ErrorMessage
  | StatusMessage
  | CompletionMessage;

const VALID_TYPES: ReadonlySet<string> = new Set([
  'task',
  'result',
  'error',
  'status',
  'completion',
]);

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceStart = trimmed.match(/^```(?:json)?\s*\n/);
  const fenceEnd = trimmed.match(/\n```\s*$/);
  if (fenceStart && fenceEnd) {
    return trimmed.slice(fenceStart[0].length, -fenceEnd[0].length).trim();
  }
  return trimmed;
}

function findJsonInText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) {
        return trimmed.slice(firstBrace, i + 1);
      }
    }
  }

  return null;
}

function validCompletionStatus(s: unknown): s is CompletionStatus {
  return s === 'DONE' || s === 'DONE_WITH_CONCERNS' || s === 'NEEDS_CONTEXT' || s === 'BLOCKED';
}

const REQUIRED_FIELDS: Record<string, Record<string, string>> = {
  task: { skill: 'string' },
  result: { taskId: 'string', status: 'string', content: 'string' },
  error: { taskId: 'string', errorType: 'string', detail: 'string' },
  status: { taskId: 'string', phase: 'string' },
  completion: { status: 'string', summary: 'string' },
};

export function parseAgnesMessage(text: string): AnyAgnesMessage | null {
  // Strip HTML comments — <agnes:message> wrappers should be invisible to users
  const noComments = text.replace(/<!--[\s\S]*?-->/g, '');
  const cleaned = stripCodeFences(noComments);
  const jsonCandidate = findJsonInText(cleaned);
  if (!jsonCandidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.type !== 'string' || !VALID_TYPES.has(obj.type)) return null;

  if (typeof obj.id !== 'string') return null;
  if (typeof obj.timestamp !== 'string') return null;

  const type = obj.type;
  const required = REQUIRED_FIELDS[type];
  if (required) {
    for (const [field, expectedType] of Object.entries(required)) {
      if (typeof obj[field] !== expectedType) return null;
    }
    if (type === 'completion' || type === 'result') {
      if (!validCompletionStatus(obj.status)) return null;
    }
  }

  if (isValidAgnesMessage(obj)) {
    return obj;
  }
  return null;
}

export function isValidAgnesMessage(obj: unknown): obj is AnyAgnesMessage {
  if (!obj || typeof obj !== 'object') return false;
  const msg = obj as Record<string, unknown>;
  if (typeof msg.type !== 'string' || !VALID_TYPES.has(msg.type)) return false;
  if (typeof msg.id !== 'string') return false;
  if (typeof msg.timestamp !== 'string') return false;

  const type = msg.type;
  const required = REQUIRED_FIELDS[type];
  if (required) {
    for (const [field, expectedType] of Object.entries(required)) {
      if (typeof msg[field] !== expectedType) return false;
    }
    if (type === 'completion' || type === 'result') {
      if (!validCompletionStatus(msg.status)) return false;
    }
  }

  return true;
}

export function serializeAgnesMessage(msg: AnyAgnesMessage): string {
  const json = JSON.stringify(msg);
  return `<agnes:message>${json}</agnes:message>`;
}

export function generateMessageId(): string {
  return randomUUID();
}

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

export function parseAgnesMessage(text: string): AnyAgnesMessage | null {
  const cleaned = stripCodeFences(text);
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

  return obj as unknown as AnyAgnesMessage;
}

export function serializeAgnesMessage(msg: AnyAgnesMessage): string {
  const json = JSON.stringify(msg);
  return `<agnes:message>${json}</agnes:message>`;
}

export function generateMessageId(): string {
  return randomUUID();
}

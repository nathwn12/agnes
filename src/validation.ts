import { isValidAgnesMessage } from './protocol.js';
import type { AnyAgnesMessage } from './protocol.js';

export const ALLOWED_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  'task',
  'result',
  'error',
  'status',
  'completion',
]);

export const ALLOWED_ERROR_TYPES: Set<string> = new Set([
  'TypeError',
  'BuildError',
  'TestFailure',
  'LintError',
  'FileNotFound',
  'PermissionDenied',
  'NetworkError',
  'TimeoutError',
  'ParseError',
  'UnknownError',
] as const satisfies string[]);

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate a raw object against AnyAgnesMessage type.
 * Delegates validation to isValidAgnesMessage from protocol.ts.
 */
export function validateMessage(raw: unknown): AnyAgnesMessage {
  if (typeof raw !== 'object' || raw === null) {
    throw new ValidationError('Not an object');
  }

  if (!isValidAgnesMessage(raw)) {
    throw new ValidationError('Object does not match AnyAgnesMessage shape');
  }

  return raw;
}

/**
 * Escape user data that may contain keys conflicting with protocol keywords.
 * If user data contains fields matching protocol keys (type, id, status, taskId, etc.),
 * prefix them with __user_ to prevent injection.
 * Pattern: LangChain's __lc_escaped__ anti-injection.
 */
const PROTOCOL_KEYS = new Set([
  'type', 'id', 'taskId', 'timestamp', 'status', 'content', 'summary',
  'artifact', 'metrics', 'skill', 'payload', 'config', 'phase', 'progress',
  'errorType', 'detail', 'stack', 'reason',
]);

export function escapeUserData(data: unknown, depth = 0, maxDepth = 20): unknown {
  if (depth >= maxDepth) return data;
  if (typeof data !== 'object' || data === null) return data;

  if (Array.isArray(data)) {
    return data.map(item => escapeUserData(item, depth + 1, maxDepth));
  }

  const escaped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const safeKey = PROTOCOL_KEYS.has(key) ? `__user_${key}` : key;
    escaped[safeKey] = escapeUserData(value, depth + 1, maxDepth);
  }
  return escaped;
}

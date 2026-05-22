import type { ResultMessage } from './protocol.js';

export const ALLOWED_RESULT_TYPES: Set<string> = new Set([
  'result',
  'error',
  'status',
  'completion',
] as const satisfies string[]);

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
 * Validate a raw object against the ResultMessage type.
 * Checks: is object, has valid 'type' field in ALLOWED_RESULT_TYPES,
 * has required fields for the specific type.
 */
export function validateResultMessage(raw: unknown): ResultMessage {
  if (typeof raw !== 'object' || raw === null) {
    throw new ValidationError('Not an object');
  }
  const msg = raw as Record<string, unknown>;

  if (typeof msg.type !== 'string' || !ALLOWED_RESULT_TYPES.has(msg.type)) {
    throw new ValidationError(`Unknown or missing type: ${msg.type}`);
  }

  // All message types must have taskId or id
  if (typeof msg.id !== 'string' && typeof msg.taskId !== 'string') {
    throw new ValidationError('Missing required field: id or taskId');
  }

  if (typeof msg.status !== 'string') {
    throw new ValidationError('Missing required field: status');
  }

  return msg as unknown as ResultMessage;
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

export function escapeUserData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;

  if (Array.isArray(data)) {
    return data.map(escapeUserData);
  }

  const escaped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const safeKey = PROTOCOL_KEYS.has(key) ? `__user_${key}` : key;
    escaped[safeKey] = escapeUserData(value);
  }
  return escaped;
}

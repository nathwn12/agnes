export type MessageType = 'task' | 'result' | 'error' | 'status' | 'completion';
export type CompletionStatus = 'DONE' | 'DONE_WITH_CONCERNS' | 'NEEDS_CONTEXT' | 'BLOCKED';

const VALID_STATUSES: readonly string[] = ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED'];
const VALID_TYPES: readonly string[] = ['task', 'result', 'error', 'status', 'completion'];

export function isValidCompletionStatus(s: unknown): s is CompletionStatus {
  return typeof s === 'string' && VALID_STATUSES.includes(s);
}

export function isValidMessageType(s: unknown): s is MessageType {
  return typeof s === 'string' && VALID_TYPES.includes(s);
}

export interface BaseMessage {
  type: MessageType;
  id: string;
  timestamp: string;
}

export interface TaskMessage extends BaseMessage {
  type: 'task';
  skill?: string;
  payload?: unknown;
  goal?: string;
  files?: string[];
  constraints?: string[] | Record<string, unknown>;
  config?: {
    tags?: string[];
    metadata?: Record<string, unknown>;
    maxDurationMs?: number;
  };
}

export interface ResultMessage extends BaseMessage {
  type: 'result';
  taskId?: string;
  status: CompletionStatus;
  content?: string;
  summary?: string;
  artifact?: unknown;
  reasoning_content?: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  taskId: string;
  errorType: string;
  detail: string;
  stack?: string;
}

export interface StatusMessage extends BaseMessage {
  type: 'status';
  taskId: string;
  phase: string;
  progress?: { current: number; total: number };
}

export interface CompletionMessage extends BaseMessage {
  type: 'completion';
  status: CompletionStatus;
  summary: string;
}

export type AnyAgnesMessage = TaskMessage | ResultMessage | ErrorMessage | StatusMessage | CompletionMessage;

const REQUIRED_FIELDS: Record<string, Record<string, string>> = {
  task: {},
  result: { taskId: 'string', status: 'string' },
  error: { taskId: 'string', errorType: 'string', detail: 'string' },
  status: { taskId: 'string', phase: 'string' },
  completion: { status: 'string', summary: 'string' },
};

export function validateMessage(obj: unknown): AnyAgnesMessage | null {
  if (!obj || typeof obj !== 'object') return null;
  const msg = obj as Record<string, unknown>;

  if (typeof msg.type !== 'string' || !isValidMessageType(msg.type)) return null;
  if (typeof msg.id !== 'string') return null;
  if (typeof msg.timestamp !== 'string') return null;

  const type = msg.type;
  const required = REQUIRED_FIELDS[type];
  if (required) {
    for (const [field, expectedType] of Object.entries(required)) {
      if (typeof msg[field] !== expectedType) return null;
    }
    if (type === 'task' && typeof msg.skill !== 'string' && typeof msg.goal !== 'string') return null;
    if (type === 'result' && typeof msg.content !== 'string' && typeof msg.summary !== 'string') return null;
    if ((type === 'completion' || type === 'result') && !isValidCompletionStatus(msg.status)) return null;
  }

  return msg as unknown as AnyAgnesMessage;
}

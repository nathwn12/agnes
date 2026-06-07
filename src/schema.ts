import { z } from 'zod';

// ── Message schemas ───────────────────────────────────────────────────────────

const MessageTypeSchema = z.enum([
  "task", "result", "error", "status", "completion"
]);

export const CompletionStatusSchema = z.enum([
  "DONE", "DONE_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED"
]);

const BaseMessageSchema = z.object({
  type: MessageTypeSchema,
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  schema: z.literal("agnes/message-v1").optional(),
}).passthrough();

export const TaskMessageSchema = BaseMessageSchema.extend({
  type: z.literal("task"),
  skill: z.string().min(1).optional(),
  payload: z.unknown().optional(),
  goal: z.string().min(1).optional(),
  files: z.array(z.string()).optional(),
  constraints: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
  config: z.object({
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    maxDurationMs: z.number().optional(),
  }).optional(),
}).refine((msg) => Boolean(msg.skill || msg.goal), {
  message: 'Task message requires either skill or goal',
});

export const ResultMessageSchema = BaseMessageSchema.extend({
  type: z.literal("result"),
  taskId: z.string().min(1),
  status: CompletionStatusSchema,
  content: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  artifact: z.unknown().optional(),
  reasoning_content: z.string().optional(),
}).refine((msg) => Boolean(msg.content || msg.summary), {
  message: 'Result message requires either content or summary',
});

export const ErrorMessageSchema = BaseMessageSchema.extend({
  type: z.literal("error"),
  taskId: z.string().min(1),
  errorType: z.string().min(1),
  detail: z.string().min(1),
  stack: z.string().optional(),
});

export const StatusMessageSchema = BaseMessageSchema.extend({
  type: z.literal("status"),
  taskId: z.string().min(1),
  phase: z.string().min(1),
  progress: z.object({
    current: z.number(),
    total: z.number(),
  }).optional(),
});

export const CompletionMessageSchema = BaseMessageSchema.extend({
  type: z.literal("completion"),
  status: CompletionStatusSchema,
  summary: z.string().min(1),
});

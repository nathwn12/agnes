import { z } from 'zod';

// ── Execution contract schemas ─────────────────────────────────────────────────

export const GateEvidenceSchema = z.object({
  gateId: z.string(),
  status: z.enum(['PASS', 'FAIL', 'SKIP']),
  evidence: z.object({
    command: z.string().optional(),
    exitCode: z.number().optional(),
    output: z.string().optional(),
    errors: z.array(z.string()),
  }),
  timestamp: z.string().datetime(),
  durationMs: z.number(),
});
export type GateEvidence = z.infer<typeof GateEvidenceSchema>;

export const RetryClassificationSchema = z.enum([
  'retryable', 'needs_context', 'blocked', 'terminal', 'verification_failed'
]);
export type RetryClassification = z.infer<typeof RetryClassificationSchema>;

export const ExecutionArtifactSchema = z.object({
  attempt: z.number().int().nonnegative(),
  gateEvidence: z.array(GateEvidenceSchema).default([]),
  retryClass: RetryClassificationSchema.optional(),
  flowSignal: z.object({
    jumpTo: z.enum(['retry', 'skip', 'blocked', 'next_wave', 'end']).nullable(),
    reason: z.string().optional(),
  }).optional(),
  completed: z.boolean(),
  summary: z.string().default(''),
  timestamp: z.string().datetime(),
});
export type ExecutionArtifact = z.infer<typeof ExecutionArtifactSchema>;

// ── Plan schemas ──────────────────────────────────────────────────────────────

export const PlanStatusSchema = z.enum([
  "pending", "draft", "reviewed", "ready", "approved", "in_progress", "done", "blocked", "abandoned"
]);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

export const PlanTaskSchema = z.object({
  id: z.string().regex(/^task-\d{3}$/),
  summary: z.string().min(1).max(200),
  status: PlanStatusSchema.default("pending"),
  files: z.array(z.string()).default([]),
  effort: z.string().regex(/^\d+m$/).optional(),
  depends_on: z.array(z.string()).default([]),
});
export type PlanTask = z.infer<typeof PlanTaskSchema>;

export const PlanSchema = z.object({
  schema: z.literal("agnes/plan-v1"),
  id: z.string().regex(/^plan-\d{3}$/),
  version: z.number().int().positive().default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: PlanStatusSchema.default("draft"),
  parent: z.string().nullable().default(null),
  goal: z.string().min(1).max(500),
  check: z.string().min(1).max(500),
  summary: z.string().min(1).max(200),
  tasks: z.array(PlanTaskSchema).default([]),
  notes: z.array(z.string()).default([]),
  plannerMode: z.enum(['builtin', 'full']).optional(),
  plannerSource: z.enum(['auto', 'user', 'gate']).optional(),
  executionArtifacts: z.array(ExecutionArtifactSchema).default([]).optional(),
});
export type Plan = z.infer<typeof PlanSchema>;

// ── Bootstrap block schemas ───────────────────────────────────────────────────

// ── Message schemas ───────────────────────────────────────────────────────────

const MessageTypeSchema = z.enum([
  "task", "result", "error", "status", "completion"
]);

export const CompletionStatusSchema = z.enum([
  "DONE", "DONE_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED"
]);

export const BaseMessageSchema = z.object({
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



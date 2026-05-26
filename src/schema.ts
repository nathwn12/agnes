import { z } from 'zod';

export type SkillPhase =
  | 'SETUP'
  | 'META'
  | 'THINK'
  | 'RESEARCH'
  | 'DESIGN'
  | 'PLAN'
  | 'PLAN_REVIEW'
  | 'BUILD'
  | 'TEST'
  | 'VERIFY'
  | 'REVIEW'
  | 'DEBUG'
  | 'SHIP'
  | 'REFLECT';

export interface SkillDescriptor {
  name: string;
  description: string;
  phase: SkillPhase;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  responseFormat: 'content' | 'content_and_artifact';
}

export interface TaskDescriptor {
  skill: string;
  payload: Record<string, unknown>;
  config?: TaskConfig;
}

export interface TaskConfig {
  tags?: string[];
  metadata?: Record<string, unknown>;
  callbacks?: string[];
  maxDurationMs?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    retryOn: string[];
  };
}

export function validatePayload(
  payload: unknown,
  schema: Record<string, unknown>,
): { valid: boolean; errors?: string[] } {
  if (!schema.required && !schema.properties) {
    return { valid: true };
  }

  if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Payload must be a non-null object'] };
  }

  const errors: string[] = [];

  if (Array.isArray(schema.required)) {
    const requiredFields = schema.required as string[];
    for (const field of requiredFields) {
      if (!(field in payload)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    for (const [propName, propSchema] of Object.entries(props)) {
      if (!(propName in payload)) {
        continue;
      }
      const expectedType = propSchema.type;
      if (typeof expectedType !== 'string') {
        continue;
      }
      const actualValue = (payload as Record<string, unknown>)[propName];
      if (!typeMatches(actualValue, expectedType)) {
        errors.push(`Type mismatch for "${propName}": expected ${expectedType}, got ${typeof actualValue}`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

export function typeMatches(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function createDefaultSkillEntry(name: string, description: string, phase: SkillPhase): SkillDescriptor {
  return {
    name,
    description,
    phase,
    inputSchema: {
      type: 'object',
      properties: {
        payload: { type: 'object', description: `Payload for ${name}` },
      },
      required: ['payload'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'object', description: `Result from ${name}` },
      },
    },
    responseFormat: 'content_and_artifact',
  };
}

export const SKILL_NAME_ALIASES = new Map<string, string>([
  ['ag-orchestrator', 'orchestrator'],
  ['ag-planner', 'planner'],
  ['ag-builder', 'builder'],
  ['ag-tdd', 'tdd'],
  ['ag-reviewer', 'reviewer'],
  ['ag-verifier', 'verifier'],
  ['ag-debugger', 'debugger'],
]);

export function resolveSkillName(name: string): string {
  return SKILL_NAME_ALIASES.get(name) ?? name;
}

const CANONICAL_SKILLS: Array<[string, SkillDescriptor]> = [
  ['orchestrator', createDefaultSkillEntry(
    'orchestrator',
    'AGNES swarm brain — delegates, parallelizes, and orchestrates work across all fused skills',
    'META',
  )],
  ['planner', createDefaultSkillEntry(
    'planner',
    'Writing specs and implementation plans with structured design documents',
    'PLAN',
  )],
  ['builder', createDefaultSkillEntry(
    'builder',
    'Disciplined plan execution with worktree isolation and verify-review-commit cycle',
    'BUILD',
  )],
  ['tdd', createDefaultSkillEntry(
    'tdd',
    'Red-green-refactor TDD through vertical slices with failing test first',
    'TEST',
  )],
  ['reviewer', createDefaultSkillEntry(
    'reviewer',
    'Code quality gate with spec compliance and quality issue classification',
    'REVIEW',
  )],
  ['verifier', createDefaultSkillEntry(
    'verifier',
    'Gate discipline enforcer running automated checks with evidence-based pass/fail',
    'VERIFY',
  )],
  ['debugger', createDefaultSkillEntry(
    'debugger',
    'Collaborative debugging through reproduce-hypothesise-instrument-narrow-document',
    'DEBUG',
  )],
];

export const SKILL_REGISTRY: Map<string, SkillDescriptor> = new Map(CANONICAL_SKILLS);

for (const [legacyName, canonicalName] of SKILL_NAME_ALIASES) {
  const entry = SKILL_REGISTRY.get(canonicalName);
  if (entry) SKILL_REGISTRY.set(legacyName, entry);
}

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
});
export type Plan = z.infer<typeof PlanSchema>;

// ── Bootstrap block schemas ───────────────────────────────────────────────────

export const BootstrapBlockTypeSchema = z.enum([
  "runtime", "orchestrator", "named_roles", "plan_state", "shell", "execution", "protocol", "skill_registry"
]);

export const BootstrapBlockSchema = z.object({
  type: BootstrapBlockTypeSchema,
}).passthrough();

export const RuntimeBlockSchema = BootstrapBlockSchema.extend({
  type: z.literal("runtime"),
  agnes_version: z.string(),
  package_root: z.string(),
  skills_dir: z.string(),
  cache_root: z.string(),
});

export const OrchestratorBlockSchema = BootstrapBlockSchema.extend({
  type: z.literal("orchestrator"),
  rules: z.record(z.string(), z.boolean()),
});

// ── Message schemas ───────────────────────────────────────────────────────────

export const MessageTypeSchema = z.enum([
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
  goal: z.string().min(1),
  files: z.array(z.string()),
  constraints: z.object({
    no_shared_edits: z.boolean().default(true),
    read_only: z.boolean().default(false),
  }).optional(),
});

export const ResultMessageSchema = BaseMessageSchema.extend({
  type: z.literal("result"),
  status: CompletionStatusSchema,
  summary: z.string().min(1),
  artifact: z.record(z.string(), z.unknown()).optional(),
  reasoning_content: z.string().optional(),
});

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

export const SKILL_REGISTRY: Map<string, SkillDescriptor> = new Map([
  ['ag-orchestrator', createDefaultSkillEntry(
    'ag-orchestrator',
    'AGNES swarm brain — delegates, parallelizes, and orchestrates work across all fused skills',
    'META',
  )],
  ['ag-planner', createDefaultSkillEntry(
    'ag-planner',
    'Writing specs and implementation plans with structured design documents',
    'PLAN',
  )],
  ['ag-builder', createDefaultSkillEntry(
    'ag-builder',
    'Disciplined plan execution with worktree isolation and verify-review-commit cycle',
    'BUILD',
  )],
  ['ag-tdd', createDefaultSkillEntry(
    'ag-tdd',
    'Red-green-refactor TDD through vertical slices with failing test first',
    'TEST',
  )],
  ['ag-reviewer', createDefaultSkillEntry(
    'ag-reviewer',
    'Code quality gate with spec compliance and quality issue classification',
    'REVIEW',
  )],
  ['ag-verifier', createDefaultSkillEntry(
    'ag-verifier',
    'Gate discipline enforcer running automated checks with evidence-based pass/fail',
    'VERIFY',
  )],
  ['ag-debugger', createDefaultSkillEntry(
    'ag-debugger',
    'Collaborative debugging through reproduce-hypothesise-instrument-narrow-document',
    'DEBUG',
  )],
]);

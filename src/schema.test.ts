import { describe, expect, test } from 'bun:test';
import { typeMatches, validatePayload, SKILL_REGISTRY, SKILL_NAME_ALIASES, resolveSkillName, PlanSchema, PlanTaskSchema, PlanStatusSchema } from './schema.js';
import type { SkillDescriptor } from './schema.js';

describe('PlanSchema', () => {
  const validPlan = {
    schema: 'agnes/plan-v1',
    id: 'plan-001',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'draft',
    parent: null,
    goal: 'Implement feature X',
    check: 'All tests pass',
    summary: 'Feature X implementation',
    tasks: [],
  };

  test('valid plan passes validation', () => {
    const result = PlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  test('invalid status values fail', () => {
    const result = PlanSchema.safeParse({ ...validPlan, status: 'invalid_status' });
    expect(result.success).toBe(false);
  });

  test('missing required field goal fails', () => {
    const { goal, ...withoutGoal } = validPlan;
    const result = PlanSchema.safeParse(withoutGoal);
    expect(result.success).toBe(false);
  });

  test('missing required field id fails', () => {
    const { id, ...withoutId } = validPlan;
    const result = PlanSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  test('tasks with wrong ID pattern fail', () => {
    const plan = {
      ...validPlan,
      tasks: [{ id: 'task-bad', summary: 'bad id task' }],
    };
    const result = PlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  test('tasks with valid ID pattern pass', () => {
    const plan = {
      ...validPlan,
      tasks: [{ id: 'task-007', summary: 'Valid task' }],
    };
    const result = PlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  test('empty tasks array is valid', () => {
    const plan = { ...validPlan, tasks: [] };
    const result = PlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  test('plan with all fields round-trips through JSON', () => {
    const plan = {
      ...validPlan,
      tasks: [
        { id: 'task-001', summary: 'First task', status: 'pending', files: ['src/a.ts'], effort: '120m', depends_on: [] },
        { id: 'task-002', summary: 'Second task', status: 'done', files: ['src/b.ts'], effort: '60m', depends_on: ['task-001'] },
      ],
      notes: ['Note 1', 'Note 2'],
    };
    const parsed = PlanSchema.parse(plan);
    const json = JSON.parse(JSON.stringify(parsed));
    const result = PlanSchema.safeParse(json);
    expect(result.success).toBe(true);
    expect(result.data!.tasks.length).toBe(2);
    expect(result.data!.id).toBe('plan-001');
  });

  test('PlanStatusSchema only accepts valid status strings', () => {
    const valid = PlanStatusSchema.safeParse('in_progress');
    expect(valid.success).toBe(true);

    const invalid = PlanStatusSchema.safeParse('unknown');
    expect(invalid.success).toBe(false);
  });

  test('PlanStatusSchema accepts approved plans', () => {
    const result = PlanStatusSchema.safeParse('approved');
    expect(result.success).toBe(true);
  });

  test('PlanTaskSchema validates effort format', () => {
    const good = PlanTaskSchema.safeParse({ id: 'task-001', summary: 'task', effort: '30m' });
    expect(good.success).toBe(true);

    const bad = PlanTaskSchema.safeParse({ id: 'task-001', summary: 'task', effort: '2hours' });
    expect(bad.success).toBe(false);
  });
});

describe('typeMatches', () => {
  test('string type matches string value', () => {
    expect(typeMatches('hello', 'string')).toBe(true);
    expect(typeMatches(42, 'string')).toBe(false);
  });

  test('number type matches number value', () => {
    expect(typeMatches(42, 'number')).toBe(true);
    expect(typeMatches(3.14, 'number')).toBe(true);
    expect(typeMatches('42', 'number')).toBe(false);
  });

  test('integer type matches integer not float', () => {
    expect(typeMatches(42, 'integer')).toBe(true);
    expect(typeMatches(0, 'integer')).toBe(true);
    expect(typeMatches(-7, 'integer')).toBe(true);
    expect(typeMatches(3.14, 'integer')).toBe(false);
    expect(typeMatches('42', 'integer')).toBe(false);
  });

  test('boolean type matches boolean', () => {
    expect(typeMatches(true, 'boolean')).toBe(true);
    expect(typeMatches(false, 'boolean')).toBe(true);
    expect(typeMatches(0, 'boolean')).toBe(false);
    expect(typeMatches('true', 'boolean')).toBe(false);
  });

  test('object type matches plain object', () => {
    expect(typeMatches({ key: 'val' }, 'object')).toBe(true);
    expect(typeMatches(null, 'object')).toBe(false);
    expect(typeMatches([1, 2], 'object')).toBe(false);
    expect(typeMatches('str', 'object')).toBe(false);
  });

  test('array type matches array', () => {
    expect(typeMatches([1, 2, 3], 'array')).toBe(true);
    expect(typeMatches([], 'array')).toBe(true);
    expect(typeMatches({}, 'array')).toBe(false);
    expect(typeMatches(null, 'array')).toBe(false);
  });

  test('null type matches null', () => {
    expect(typeMatches(null, 'null')).toBe(true);
    expect(typeMatches(undefined, 'null')).toBe(false);
    expect(typeMatches(0, 'null')).toBe(false);
  });

  test('unknown type returns true (default case)', () => {
    expect(typeMatches('anything', 'unknown')).toBe(true);
    expect(typeMatches(42, 'whatever')).toBe(true);
    expect(typeMatches(null, 'custom_type')).toBe(true);
  });
});

describe('validatePayload', () => {
  test('valid payload with all required fields passes', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    };
    const result = validatePayload({ name: 'Alice', age: 30 }, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test('missing required field fails', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    };
    const result = validatePayload({ name: 'Alice' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/Missing required field: age/));
  });

  test('field with wrong type fails', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };
    const result = validatePayload({ name: 'Alice', age: 'thirty' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringMatching(/Type mismatch for "age": expected number, got string/),
    );
  });

  test('extra fields pass (lenient)', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };
    const result = validatePayload({ name: 'Alice', extra: 'should be ignored' }, schema);
    expect(result.valid).toBe(true);
  });

  test('empty required array passes', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: [],
    };
    const result = validatePayload({ name: 'Alice' }, schema);
    expect(result.valid).toBe(true);
  });

  test('no required or properties returns valid', () => {
    const result = validatePayload({ anything: 'goes' }, {});
    expect(result.valid).toBe(true);
  });

  test('null payload fails', () => {
    const schema = { type: 'object', required: ['name'] };
    const result = validatePayload(null, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/Payload must be a non-null object/));
  });

  test('array payload fails', () => {
    const schema = { type: 'object', required: ['name'] };
    const result = validatePayload([1, 2, 3], schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/Payload must be a non-null object/));
  });
});

describe('SKILL_REGISTRY', () => {
  test('is not empty after module load', () => {
    expect(SKILL_REGISTRY.size).toBeGreaterThan(0);
  });

  test('contains expected skill names', () => {
    const expected = [
      'orchestrator',
      'planner',
      'builder',
      'tdd',
      'reviewer',
      'verifier',
      'debugger',
    ];
    for (const name of expected) {
      expect(SKILL_REGISTRY.has(name)).toBe(true);
    }
  });

  test('legacy aliases still resolve to canonical names', () => {
    for (const [legacyName, canonicalName] of SKILL_NAME_ALIASES) {
      expect(resolveSkillName(legacyName)).toBe(canonicalName);
      expect(SKILL_REGISTRY.has(legacyName)).toBe(true);
    }
  });

  test('each entry has valid SkillDescriptor shape', () => {
    for (const [name, entry] of SKILL_REGISTRY) {
      expect(typeof name).toBe('string');
      expect(typeof (entry as SkillDescriptor).name).toBe('string');
      expect(typeof (entry as SkillDescriptor).description).toBe('string');
      expect(typeof (entry as SkillDescriptor).phase).toBe('string');
      expect(typeof (entry as SkillDescriptor).inputSchema).toBe('object');
      expect(typeof (entry as SkillDescriptor).outputSchema).toBe('object');
      expect(['content', 'content_and_artifact']).toContain(
        (entry as SkillDescriptor).responseFormat,
      );
    }
  });

  test('each entry with inputSchema has valid schema structure', () => {
    for (const [, entry] of SKILL_REGISTRY) {
      const schema = (entry as SkillDescriptor).inputSchema;
      if (Object.keys(schema).length > 0) {
        expect(schema).toHaveProperty('type');
      }
    }
  });
});

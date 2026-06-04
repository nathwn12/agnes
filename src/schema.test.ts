import { describe, expect, test } from 'bun:test';
import { PlanSchema, PlanTaskSchema, PlanStatusSchema, GateEvidenceSchema, RetryClassificationSchema, ExecutionArtifactSchema } from './schema.js';

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
    plannerMode: 'builtin',
    plannerSource: 'user',
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
    const { goal: _goal, ...withoutGoal } = validPlan;
    const result = PlanSchema.safeParse(withoutGoal);
    expect(result.success).toBe(false);
  });

  test('missing required field id fails', () => {
    const { id: _id, ...withoutId } = validPlan;
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

  test('planner provenance round-trips through validation', () => {
    const result = PlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
    expect(result.data!.plannerMode).toBe('builtin');
    expect(result.data!.plannerSource).toBe('user');
  });

  test('executionArtifacts field defaults to empty array', () => {
    const result = PlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
    expect(result.data!.executionArtifacts).toEqual([]);
  });

  test('executionArtifacts round-trips through JSON', () => {
    const plan = {
      ...validPlan,
      executionArtifacts: [
        {
          attempt: 1,
          completed: false,
          summary: 'first attempt',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        {
          attempt: 2,
          completed: true,
          summary: 'second attempt succeeded',
          timestamp: '2026-01-01T00:01:00.000Z',
        },
      ],
    };
    const parsed = PlanSchema.parse(plan);
    const json = JSON.parse(JSON.stringify(parsed));
    const result = PlanSchema.safeParse(json);
    expect(result.success).toBe(true);
    expect(result.data!.executionArtifacts).toBeDefined();
    expect(result.data!.executionArtifacts!.length).toBe(2);
    expect(result.data!.executionArtifacts![0].attempt).toBe(1);
    expect(result.data!.executionArtifacts![1].completed).toBe(true);
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




describe('GateEvidenceSchema', () => {
  test('valid gate evidence passes', () => {
    const result = GateEvidenceSchema.safeParse({
      gateId: 'test-gate',
      status: 'PASS',
      evidence: { errors: [] },
      timestamp: '2026-01-01T00:00:00.000Z',
      durationMs: 100,
    });
    expect(result.success).toBe(true);
  });

  test('invalid status fails', () => {
    const result = GateEvidenceSchema.safeParse({
      gateId: 'test-gate',
      status: 'INVALID',
      evidence: { errors: [] },
      timestamp: '2026-01-01T00:00:00.000Z',
      durationMs: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe('RetryClassificationSchema', () => {
  test.each(['retryable', 'needs_context', 'blocked', 'terminal', 'verification_failed'])('accepts %s', (val: string) => {
    expect(RetryClassificationSchema.safeParse(val).success).toBe(true);
  });

  test('rejects invalid values', () => {
    expect(RetryClassificationSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('ExecutionArtifactSchema', () => {
  test('valid minimal artifact passes', () => {
    const result = ExecutionArtifactSchema.safeParse({
      attempt: 1,
      completed: false,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  test('valid full artifact passes', () => {
    const result = ExecutionArtifactSchema.safeParse({
      attempt: 2,
      gateEvidence: [{
        gateId: 'g1',
        status: 'PASS',
        evidence: { errors: [] },
        timestamp: '2026-01-01T00:00:00.000Z',
        durationMs: 50,
      }],
      retryClass: 'retryable',
      flowSignal: { jumpTo: 'retry', reason: 'timeout' },
      completed: false,
      summary: 'first attempt timed out',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  test('negative attempt fails', () => {
    const result = ExecutionArtifactSchema.safeParse({
      attempt: -1,
      completed: false,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

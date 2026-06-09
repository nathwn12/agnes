import { describe, expect, test } from 'bun:test';
import { runReview } from './reviewer.js';
import type { TaskPlan } from './planner.js';

function makePlan(overrides?: Partial<TaskPlan>): TaskPlan {
  return {
    id: 'test-plan-001',
    goal: 'test',
    phase: 'running',
    tasks: [],
    iteration: 0,
    maxIterations: 3,
    startTime: Date.now(),
    editedFiles: [],
    waves: [{ index: 0, taskIDs: [] }],
    currentWaveIndex: 0,
    ...overrides,
  };
}

describe('runReview', () => {
  test('passes for completed plan with no errors', async () => {
    const plan = makePlan({
      tasks: [{ id: 'task-0001', description: 'a', files: [], dependsOn: [], agent: 'general', status: 'completed', retryCount: 0, result: '\xA7AM{"t":"completion","i":"task-0001","s":"DONE","c":"done","a":{}}' }],
    });
    const verdict = await runReview(plan);
    expect(verdict.passed).toBe(true);
  });

  test('acceptance criteria gate does not mutate task status', async () => {
    const plan = makePlan({
      tasks: [{
        id: 'task-0001', description: 'a', files: [], dependsOn: [], agent: 'general',
        status: 'completed', retryCount: 0,
        acceptanceCriteria: 'Must handle edge cases gracefully',
        result: 'Implemented the feature. Tests pass. Everything works correctly.\n\n\xA7AM{"t":"completion","i":"task-0001","s":"DONE","c":"done","a":{}}',
      }],
    });
    const verdict = await runReview(plan);
    // Acceptance gate may fail keyword check but NOT mutate task status
    expect(plan.tasks[0].status).toBe('completed');
    // If it failed, verdict.passed should still be false but status unchanged
    if (!verdict.passed) {
      expect(plan.tasks[0].status).toBe('completed');
    }
  });

  test('blocking gate failure returns failed verdict instead of throwing', async () => {
    const plan = makePlan({
      tasks: [{ id: 'task-0001', description: 'a', files: [], dependsOn: [], agent: 'general', status: 'failed', retryCount: 0, error: 'oops' }],
    });
    // Should NOT throw — blocking failure becomes failed verdict
    const verdict = await runReview(plan);
    expect(verdict.passed).toBe(false);
    expect(verdict.failedGates.length).toBeGreaterThan(0);
  });

  test('passes for empty plan', async () => {
    const plan = makePlan();
    const verdict = await runReview(plan);
    expect(verdict.passed).toBe(true);
  });
});

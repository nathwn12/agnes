import { describe, expect, test } from 'bun:test';
import {
  checkIterationCompletion,
  buildIterationReport,
  mergeIterationIntoState,
  buildExecutionContext,
} from './runtime.js';
import type { AgnesRuntimeState } from './runtime.js';
import { freshStruggleMetrics } from './state.js';

describe('checkIterationCompletion', () => {
  test('detects completion with expected promise', () => {
    const result = checkIterationCompletion('some work\n<promise>DONE</promise>', 'DONE');
    expect(result.detected).toBe(true);
    expect(result.tag).toBe('DONE');
  });

  test('detects completion without expected promise', () => {
    const result = checkIterationCompletion('<promise>COMPLETE</promise>');
    expect(result.detected).toBe(true);
    expect(result.tag).toBe('COMPLETE');
  });

  test('returns not detected when no promise tag', () => {
    const result = checkIterationCompletion('just some output');
    expect(result.detected).toBe(false);
    expect(result.tag).toBeNull();
  });

  test('returns not detected when wrong promise expected', () => {
    const result = checkIterationCompletion('<promise>DONE</promise>', 'COMPLETE');
    expect(result.detected).toBe(false);
    expect(result.tag).toBe('DONE');
  });
});

describe('buildIterationReport', () => {
  test('builds report with completion detected', () => {
    const report = buildIterationReport({
      iteration: 1,
      durationMs: 45000,
      filesChanged: 3,
      errors: [],
      output: 'work done\n<promise>DONE</promise>',
      exitCode: 0,
      completionPromise: 'DONE',
    });
    expect(report.iteration).toBe(1);
    expect(report.completionDetected).toBe(true);
    expect(report.hadProgress).toBe(true);
    expect(report.promiseTag).toBe('DONE');
    expect(report.exitCode).toBe(0);
  });

  test('builds report with no completion', () => {
    const report = buildIterationReport({
      iteration: 2,
      durationMs: 15000,
      filesChanged: 0,
      errors: ['Error: something'],
      output: 'Error: something',
      exitCode: 1,
    });
    expect(report.completionDetected).toBe(false);
    expect(report.hadProgress).toBe(false);
    expect(report.promiseTag).toBeNull();
    expect(report.errors).toContainEqual(expect.stringMatching(/something/));
  });
});

describe('mergeIterationIntoState', () => {
  test('merges report into state and detects completion', () => {
    const state: AgnesRuntimeState = {
      hasActivePlan: true,
      activePlanId: 'plan-001',
      planContent: 'Goal: Test',
      planEntry: null,
    };

    const report = buildIterationReport({
      iteration: 1,
      durationMs: 45000,
      filesChanged: 2,
      errors: [],
      output: '<promise>DONE</promise>',
      exitCode: 0,
      completionPromise: 'DONE',
    });

    const result = mergeIterationIntoState(state, report);
    expect(result.completed).toBe(true);
    expect(result.struggleWarnings).toEqual([]);
    expect(state.iteration).toBe(1);
    expect(state.struggle?.lastPromiseTag).toBe('DONE');
  });

  test('accumulates struggle across iterations', () => {
    const state: AgnesRuntimeState = {
      hasActivePlan: true,
      activePlanId: 'plan-001',
      planContent: 'Goal: Test',
      planEntry: null,
    };

    // First: no progress, short iteration
    const r1 = buildIterationReport({
      iteration: 1,
      durationMs: 10000,
      filesChanged: 0,
      errors: ['Error: failed'],
      output: 'Error: failed',
      exitCode: 1,
    });
    mergeIterationIntoState(state, r1);

    // Second: same pattern
    const r2 = buildIterationReport({
      iteration: 2,
      durationMs: 5000,
      filesChanged: 0,
      errors: ['Error: failed'],
      output: 'Error: failed',
      exitCode: 1,
    });
    const result = mergeIterationIntoState(state, r2);

    expect(state.struggle?.noProgressIterations).toBe(2);
    expect(state.struggle?.shortIterations).toBe(2);
    expect(state.struggle?.repeatedErrors['Error: failed']).toBe(2);
    // Repeated error threshold is >=2, so one warning already
    expect(result.struggleWarnings.length).toBeGreaterThanOrEqual(1);
  });

  test('produces struggle warnings at threshold', () => {
    const state: AgnesRuntimeState = {
      hasActivePlan: true,
      activePlanId: 'plan-001',
      planContent: 'Goal: Test',
      planEntry: null,
    };

    // Three iterations of no progress
    for (let i = 1; i <= 3; i++) {
      const report = buildIterationReport({
        iteration: i,
        durationMs: 10000,
        filesChanged: 0,
        errors: [],
        output: 'no progress',
        exitCode: 1,
      });
      const result = mergeIterationIntoState(state, report);
      if (i === 3) {
        expect(result.struggleWarnings.length).toBeGreaterThanOrEqual(1);
        expect(result.struggleWarnings[0]).toMatch(/no progress/i);
      }
    }
  });
});

describe('buildExecutionContext', () => {
  test('includes attempt info when present', () => {
    const ctx = buildExecutionContext({
      id: 'plan-001',
      status: 'in_progress',
      createdAt: '',
      updatedAt: '',
      summary: 'Test',
      total: 1,
      completed: 0,
      blocked: 0,
      file: 'plan-001.md',
      attempts: 2,
      struggle: freshStruggleMetrics(),
    });
    expect(ctx).toContain('Current attempt: 3');
    expect(ctx).toContain('<promise>DONE</promise>');
  });

  test('includes struggle warnings when thresholds reached', () => {
    const ctx = buildExecutionContext({
      id: 'plan-001',
      status: 'in_progress',
      createdAt: '',
      updatedAt: '',
      summary: 'Test',
      total: 1,
      completed: 0,
      blocked: 0,
      file: 'plan-001.md',
      attempts: 3,
      struggle: {
        noProgressIterations: 3,
        shortIterations: 2,
        repeatedErrors: { 'Error: timeout': 2 },
        lastPromiseTag: null,
      },
    });
    expect(ctx).toContain('multiple iterations without file changes');
    expect(ctx).toContain('recurring error');
  });

  test('includes last promise tag when set', () => {
    const ctx = buildExecutionContext({
      id: 'plan-001',
      status: 'in_progress',
      createdAt: '',
      updatedAt: '',
      summary: 'Test',
      total: 1,
      completed: 0,
      blocked: 0,
      file: 'plan-001.md',
      attempts: 0,
      struggle: {
        noProgressIterations: 0,
        shortIterations: 0,
        repeatedErrors: {},
        lastPromiseTag: 'DONE',
      },
    });
    expect(ctx).toContain('<promise>DONE</promise>');
  });
});

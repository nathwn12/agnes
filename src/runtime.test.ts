import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  checkIterationCompletion,
  buildIterationReport,
  mergeIterationIntoState,
  buildExecutionContext,
  recordAttempt,
  classifyIntent,
  classifyComplexity,
  classifyPlannerRoute,
  classifyPlannerScope,
  requestMatchesPlan,
  processMessage,
  checkPlanDrift,
  assertTaskScope,
  runWaveGates,
  executeWave,
  getPlanGateFromState,
} from './runtime.js';
import type { AgnesRuntimeState, ProcessMessageResult } from './runtime.js';
import { FlowController } from './flowcontrol.js';
import type { PlanIndex } from './state.js';
import { freshStruggleMetrics } from './state.js';
import type { Gate, GateResult } from './verification.js';
import { MiddlewareChain, defaultMiddlewareChain } from './middleware.js';
import type { TaskDescriptor } from './schema.js';

function makeGateResult(overrides: Partial<GateResult>): GateResult {
  return {
    gateId: 'test-gate',
    status: 'PASS',
    evidence: { errors: [] },
    timestamp: new Date().toISOString(),
    durationMs: 0,
    ...overrides,
  };
}

function makeGate(result: GateResult, isBlocking = true): Gate {
  return {
    id: result.gateId,
    name: result.gateId,
    description: '',
    isBlocking,
    run: async () => result,
  };
}

describe('checkIterationCompletion', () => {
  test('detects completion with expected promise', () => {
    const result = checkIterationCompletion('some work\n<promise>DONE</promise>', 'DONE');
    expect(result.detected).toBe(true);
    expect(result.tag).toBe('DONE');
  });

  test('detects completion without expected promise', () => {
    const result = checkIterationCompletion('<promise>DONE</promise>');
    expect(result.detected).toBe(true);
    expect(result.tag).toBe('DONE');
  });

  test('returns not detected when no promise tag', () => {
    const result = checkIterationCompletion('just some output');
    expect(result.detected).toBe(false);
    expect(result.tag).toBeNull();
  });

  test('legacy fallback ignores expected — detects any promise tag', () => {
    const result = checkIterationCompletion('<promise>DONE</promise>', 'COMPLETE');
    expect(result.detected).toBe(true);
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
      file: 'plan-001.yaml',
      attempts: 2,
      struggle: freshStruggleMetrics(),
    });
    expect(ctx).toContain('Current attempt: 3');
    expect(ctx).toContain('{"type":"completion","status":"DONE","summary":"..."}');
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
      file: 'plan-001.yaml',
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
      file: 'plan-001.yaml',
      attempts: 0,
      struggle: {
        noProgressIterations: 0,
        shortIterations: 0,
        repeatedErrors: {},
        lastPromiseTag: 'DONE',
      },
    });
    expect(ctx).toContain('{"type":"completion","status":"DONE","summary":"..."}');
  });
});

describe('recordAttempt', () => {
  test('with promise tag returns completed:true and resets attempt count', () => {
    const sessionId = randomUUID();
    const result1 = recordAttempt(sessionId, null);
    expect(result1.attempt).toBe(1);
    expect(result1.completed).toBe(false);

    const result2 = recordAttempt(sessionId, 'DONE');
    expect(result2.attempt).toBe(0);
    expect(result2.completed).toBe(true);
  });

  test('without promise tag increments attempt count', () => {
    const sessionId = randomUUID();
    const result1 = recordAttempt(sessionId, null);
    expect(result1.attempt).toBe(1);
    expect(result1.completed).toBe(false);

    const result2 = recordAttempt(sessionId, null);
    expect(result2.attempt).toBe(2);
    expect(result2.completed).toBe(false);
  });

  test('resets after promise tag then increments again', () => {
    const sessionId = randomUUID();
    const r1 = recordAttempt(sessionId, null);
    expect(r1.attempt).toBe(1);

    const r2 = recordAttempt(sessionId, 'NEEDS_CONTEXT');
    expect(r2.completed).toBe(false);
    expect(r2.attempt).toBe(2);

    const r3 = recordAttempt(sessionId, null);
    expect(r3.attempt).toBe(3);
    expect(r3.completed).toBe(false);
  });

  test('only DONE promise tags complete the loop', () => {
    expect(recordAttempt(randomUUID(), 'DONE').completed).toBe(true);
    expect(recordAttempt(randomUUID(), 'DONE').completed).toBe(true);
    expect(recordAttempt(randomUUID(), 'NEEDS_CONTEXT').completed).toBe(false);
  });

  test('auto-blocks after 3 failed attempts', () => {
    const sessionId = randomUUID();
    const r1 = recordAttempt(sessionId, null);
    expect(r1.attempt).toBe(1);
    expect(r1.blocked).toBeUndefined();

    const r2 = recordAttempt(sessionId, null);
    expect(r2.attempt).toBe(2);
    expect(r2.blocked).toBeUndefined();

    const r3 = recordAttempt(sessionId, null);
    expect(r3.attempt).toBe(3);
    expect(r3.completed).toBe(false);
    expect(r3.blocked).toBe(true);
  });

  test('tracks struggle metrics across failed attempts', () => {
    const sessionId = randomUUID();
    // Each failed attempt should increment noProgressIterations
    const r1 = recordAttempt(sessionId, null);
    expect(r1.attempt).toBe(1);

    const r2 = recordAttempt(sessionId, null);
    expect(r2.attempt).toBe(2);

    const r3 = recordAttempt(sessionId, null);
    expect(r3.blocked).toBe(true);
  });
});

describe('classifyIntent', () => {
  test('returns clarify for questions with ?', () => {
    expect(classifyIntent('what is AGNES?').category).toBe('clarify');
  });

  test('returns clarify for explanatory phrases', () => {
    expect(classifyIntent('explain how this works').category).toBe('clarify');
    expect(classifyIntent('describe the architecture').category).toBe('clarify');
    expect(classifyIntent('why is it failing').category).toBe('clarify');
  });

  test('returns implement for bug fixes', () => {
    expect(classifyIntent('fix the login bug').category).toBe('implement');
  });

  test('returns implement for feature additions', () => {
    expect(classifyIntent('add a new feature').category).toBe('implement');
    expect(classifyIntent('build user authentication').category).toBe('implement');
  });

  test('returns implement for refactoring', () => {
    expect(classifyIntent('refactor the auth module').category).toBe('implement');
  });

  test('returns plan when both plan and implementation words present', () => {
    expect(classifyIntent('plan to implement login').category).toBe('plan');
    expect(classifyIntent('plan for build').category).toBe('plan');
  });

  test('returns unknown for greetings', () => {
    expect(classifyIntent('hello there').category).toBe('unknown');
  });

  test('returns unknown for empty string', () => {
    expect(classifyIntent('').category).toBe('unknown');
  });

  test('returns implement for "doesn\'t work" phrases', () => {
    expect(classifyIntent("it doesn't work").category).toBe('implement');
  });

  test('returns debug intent for debug requests', () => {
    const result = classifyIntent('debug the login issue');
    expect(result.category).toBe('debug');
    expect(result.suggestedSkills).toEqual(['debugger', 'griller']);
  });

  test('returns review intent for review requests', () => {
    const result = classifyIntent('review the auth module');
    expect(result.category).toBe('review');
    expect(result.suggestedSkills).toEqual(['reviewer', 'verifier']);
  });

  test('returns test intent for test requests', () => {
    const result = classifyIntent('test the login flow');
    expect(result.category).toBe('test');
    expect(result.suggestedSkills).toEqual(['tdd', 'tester']);
  });

  test('returns implement for "test fails" phrases', () => {
    expect(classifyIntent('the test fails').category).toBe('implement');
  });

  test('clarify takes precedence over implement and plan', () => {
    expect(classifyIntent('what is the plan to fix the bug?').category).toBe('clarify');
  });
});

describe('classifyComplexity', () => {
  test('short fix request returns trivial', () => {
    expect(classifyComplexity('Fix the typo in login.ts')).toBe('trivial');
  });

  test('rename request returns trivial', () => {
    expect(classifyComplexity('Rename getCwd to getCurrentDir')).toBe('trivial');
  });

  test('single-sentence request returns trivial', () => {
    expect(classifyComplexity('Add error handling to the auth function')).toBe('trivial');
  });

  test('multi-step feature request returns complex', () => {
    expect(classifyComplexity('Implement a user registration feature with email verification and profile page')).toBe('complex');
  });

  test('refactor keyword returns complex', () => {
    expect(classifyComplexity('Refactor the database layer to use transactions')).toBe('complex');
  });

  test('connectors like "then" signal complex', () => {
    expect(classifyComplexity('Fix the login then add error handling')).toBe('complex');
  });

  test('simple "also" sentence is now trivial', () => {
    expect(classifyComplexity('Also need to update the tests')).toBe('trivial');
  });

  test('empty string returns trivial', () => {
    expect(classifyComplexity('')).toBe('trivial');
  });

  test('more than 3 sentences signals complex', () => {
    expect(classifyComplexity('Step one. Step two. Step three. Step four.')).toBe('complex');
  });

  test('3 or fewer sentences is trivial', () => {
    expect(classifyComplexity('Step one. Step two. Step three.')).toBe('trivial');
  });
});

describe('classifyPlannerScope', () => {
  test('returns trivial for short implement request', () => {
    expect(classifyPlannerScope('Fix the typo in login.ts')).toBe('trivial');
  });

  test('returns lightweight for narrow implement request', () => {
    expect(classifyPlannerScope('Add error handling to the auth function')).toBe('lightweight');
  });

  test('returns complex for broad refactor request', () => {
    expect(classifyPlannerScope('Refactor the database layer to use transactions')).toBe('complex');
  });
});

describe('classifyPlannerRoute', () => {
  test('routes lightweight tasks to builtin in auto mode', () => {
    const decision = classifyPlannerRoute('Add error handling to the auth function');
    expect(decision.route).toBe('builtin');
    expect(decision.mode).toBe('auto');
  });

  test('routes broad tasks to full in auto mode', () => {
    const decision = classifyPlannerRoute('Refactor the database layer to use transactions');
    expect(decision.route).toBe('full');
  });

  test('forced full overrides builtin eligibility', () => {
    const decision = classifyPlannerRoute('Add error handling to the auth function', 'full');
    expect(decision.route).toBe('full');
    expect(decision.reason).toContain('forced-full');
  });
});

describe('requestMatchesPlan', () => {
  test('returns true when significant token overlap', () => {
    expect(requestMatchesPlan('fix the login bug', 'Plan to fix the login bug')).toBe(true);
  });

  test('returns true with partial overlap meeting threshold', () => {
    expect(requestMatchesPlan('add search bar', 'Implement search feature')).toBe(true);
  });

  test('returns false when no overlap', () => {
    expect(requestMatchesPlan('fix the login bug', 'Add user profile page')).toBe(false);
  });

  test('returns false for empty message', () => {
    expect(requestMatchesPlan('', 'some plan content')).toBe(false);
  });

  test('ignores stopwords in matching', () => {
    expect(requestMatchesPlan('the bug in the login', 'fix the login bug')).toBe(true);
  });
});

describe('processMessage', () => {
  const mockIndexWithPlan: PlanIndex = {
    agnesVersion: '0.7.2',
    schemaVersion: 2,
    projectDir: '/test',
    projectName: 'test',
    updatedAt: '2026-01-01T00:00:00.000Z',
    activePlanId: 'plan-001',
    plans: [
      { id: 'plan-001', status: 'in_progress', createdAt: '', updatedAt: '', summary: 'Test', total: 1, completed: 0, blocked: 0, file: 'plan-001.yaml' },
    ],
  };

  const mockIndexWithApprovedPlan: PlanIndex = {
    ...mockIndexWithPlan,
    plans: [
      { id: 'plan-001', status: 'approved', createdAt: '', updatedAt: '', summary: 'Test', total: 1, completed: 0, blocked: 0, file: 'plan-001.yaml' },
    ],
  };

  const mockIndexWithoutPlan: PlanIndex = {
    agnesVersion: '0.7.2',
    schemaVersion: 2,
    projectDir: '/test',
    projectName: 'test',
    updatedAt: '2026-01-01T00:00:00.000Z',
    activePlanId: null,
    plans: [],
  };

  test('routes lightweight implement intent without active plan to builtin planner', () => {
    const result = processMessage('Add error handling to the auth function', {
      ...mockIndexWithoutPlan,
      projectDir: '/test',
    }, null);
    expect(result.type).toBe('proceed');
    if (result.type === 'proceed') {
      expect(result.context).toBe('lightweight');
    }
  });

  test('routes complex implement intent without active plan to full planner path', () => {
    const result = processMessage('Refactor the database layer', mockIndexWithoutPlan, null);
    expect(result.type).toBe('proceed');
    if (result.type === 'proceed') {
      expect(result.context).toBe('complex');
    }
  });

  test('blocks implement intent when plan does not match', () => {
    const result = processMessage('Refactor the database layer', mockIndexWithApprovedPlan, 'Add user profile page') as Extract<ProcessMessageResult, { type: 'block' }>;
    expect(result.type).toBe('block');
    expect(result.reason).toBe('plan_mismatch');
  });

  test('blocks implement intent when active plan is not approved', () => {
    const result = processMessage('Refactor the database layer', mockIndexWithPlan, 'Plan to fix the login bug') as Extract<ProcessMessageResult, { type: 'block' }>;
    expect(result.type).toBe('block');
    expect(result.reason).toBe('plan_not_approved');
  });

  test('allows implement intent when approved plan matches', () => {
    const result = processMessage('fix the login bug', mockIndexWithApprovedPlan, 'Plan to fix the login bug') as Extract<ProcessMessageResult, { type: 'proceed' }>;
    expect(result.type).toBe('proceed');
    expect(result.intent).toBe('implement');
  });

  test('blocks implement intent when approved plan is superseded by direct child', () => {
    const result = processMessage('Refactor the database layer', {
      ...mockIndexWithApprovedPlan,
      plans: [
        ...mockIndexWithApprovedPlan.plans,
        { id: 'plan-002', status: 'draft', parent: 'plan-001', createdAt: '', updatedAt: '', summary: 'Child', total: 1, completed: 0, blocked: 0, file: 'plan-002.yaml' },
      ],
    }, 'Plan to fix the login bug') as Extract<ProcessMessageResult, { type: 'block' }>;
    expect(result.type).toBe('block');
    expect(result.reason).toBe('plan_not_approved');
  });

  test('bypasses gate for clarify intent', () => {
    const result = processMessage('what is AGNES?', mockIndexWithoutPlan) as Extract<ProcessMessageResult, { type: 'proceed' }>;
    expect(result.type).toBe('proceed');
    expect(result.intent).toBe('clarify');
  });

  test('bypasses gate for plan intent', () => {
    const result = processMessage('plan to implement login', mockIndexWithoutPlan) as Extract<ProcessMessageResult, { type: 'proceed' }>;
    expect(result.type).toBe('proceed');
    expect(result.intent).toBe('plan');
  });

  test('bypasses gate for unknown intent', () => {
    const result = processMessage('hello there', mockIndexWithoutPlan) as Extract<ProcessMessageResult, { type: 'proceed' }>;
    expect(result.type).toBe('proceed');
    expect(result.intent).toBe('unknown');
  });
});

describe('checkPlanDrift', () => {
  test('finds in-scope and out-of-scope files', () => {
    const { inScope, outOfScope } = checkPlanDrift(
      ['src/auth.ts', 'src/utils.ts', 'README.md'],
      ['src/auth.ts', 'src/utils.ts', 'src/main.ts'],
    );
    expect(inScope).toEqual(['src/auth.ts', 'src/utils.ts']);
    expect(outOfScope).toEqual(['README.md']);
  });

  test('handles empty edited files', () => {
    const { inScope, outOfScope } = checkPlanDrift([], ['src/auth.ts']);
    expect(inScope).toEqual([]);
    expect(outOfScope).toEqual([]);
  });

  test('handles empty plan scope', () => {
    const { inScope, outOfScope } = checkPlanDrift(['src/auth.ts'], []);
    expect(inScope).toEqual([]);
    expect(outOfScope).toEqual(['src/auth.ts']);
  });
});

describe('assertTaskScope', () => {
  test('does not throw when all files in scope', () => {
    expect(() => assertTaskScope(['src/auth.ts'], ['src/auth.ts', 'src/utils.ts'])).not.toThrow();
  });

  test('throws when out-of-scope files detected', () => {
    expect(() => assertTaskScope(['src/auth.ts', 'README.md'], ['src/auth.ts'])).toThrow(
      'Task scope violation: edited files outside plan scope: [README.md]',
    );
  });

  test('does not throw for empty lists', () => {
    expect(() => assertTaskScope([], [])).not.toThrow();
  });
});

describe('runWaveGates', () => {
  test('blocks the flow on failing blocking gates', async () => {
    const flow = new FlowController();
    const failingResult = makeGateResult({
      gateId: 'required-review',
      status: 'FAIL',
      evidence: { errors: ['tests failed'] },
    });

    const results = await runWaveGates([makeGate(failingResult)], flow);

    expect(results).toEqual([failingResult]);
    expect(flow.isBlocked()).toBe(true);
  });

  test('does not block the flow on failing non-blocking gates', async () => {
    const flow = new FlowController();
    const failingResult = makeGateResult({
      gateId: 'advisory-review',
      status: 'FAIL',
      evidence: { errors: ['advisory failed'] },
    });

    const results = await runWaveGates([makeGate(failingResult, false)], flow);

    expect(results).toEqual([failingResult]);
    expect(flow.isBlocked()).toBe(false);
  });
});

describe('executeWave', () => {
  const sampleTasks: TaskDescriptor[] = [
    { skill: 'builder', payload: { file: 'src/main.ts' } },
    { skill: 'verifier', payload: {} },
  ];

  test('returns results for each task', async () => {
    const flow = new FlowController();
    const result = await executeWave('plan-001', sampleTasks, defaultMiddlewareChain, flow);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toHaveProperty('taskId', 'task-builder');
    expect(result.results[1]).toHaveProperty('taskId', 'task-verifier');
    expect(result.nextAction).toBeNull();
  });

  test('each result has BLOCKED status (subagent handler not yet wired)', async () => {
    const flow = new FlowController();
    const result = await executeWave('plan-001', sampleTasks, defaultMiddlewareChain, flow);
    const statuses = result.results.map(r => r.status);
    expect(statuses).toEqual(['BLOCKED', 'BLOCKED']);
  });

  test('stops early when flow is blocked', async () => {
    const flow = new FlowController();
    flow.setJump('blocked', 'prerequisite_failed');
    const result = await executeWave('plan-001', sampleTasks, defaultMiddlewareChain, flow);
    expect(result.results).toHaveLength(0);
    expect(result.nextAction).toBe('blocked');
  });

  test('skips tasks when flow signal is skip', async () => {
    const flow = new FlowController();
    flow.setJump('skip', 'not_needed');
    const result = await executeWave('plan-001', sampleTasks, defaultMiddlewareChain, flow);
    expect(result.results).toHaveLength(0);
    expect(result.nextAction).toBe('skip');
  });

  test('respects skip signal between tasks', async () => {
    const flow = new FlowController();
    flow.setJump('skip', 'skip-this-wave');
    const result = await executeWave('plan-001', sampleTasks, defaultMiddlewareChain, flow);
    expect(result.results).toHaveLength(0);
  });

  test('handles empty task list', async () => {
    const flow = new FlowController();
    const result = await executeWave('plan-001', [], defaultMiddlewareChain, flow);
    expect(result.results).toHaveLength(0);
    expect(result.nextAction).toBeNull();
  });

  test('executes middleware beforeWave hook', async () => {
    const flow = new FlowController();
    let beforeRan = false;
    const customChain = new MiddlewareChain([
      { name: 'test', beforeWave: async (ctx) => { beforeRan = true; return ctx; } },
    ]);
    await executeWave('plan-001', sampleTasks, customChain, flow);
    expect(beforeRan).toBe(true);
  });

  test('executes middleware afterWave hook', async () => {
    const flow = new FlowController();
    let afterRan = false;
    const customChain = new MiddlewareChain([
      {
        name: 'test',
        afterWave: async (ctx, _results) => { afterRan = true; return ctx; },
      },
    ]);
    await executeWave('plan-001', sampleTasks, customChain, flow);
    expect(afterRan).toBe(true);
  });

  test('passes wave index through middleware', async () => {
    const flow = new FlowController();
    let capturedIndex = -1;
    const customChain = new MiddlewareChain([
      {
        name: 'test',
        beforeWave: async (ctx) => { capturedIndex = ctx.waveIndex; return ctx; },
      },
    ]);
    await executeWave('plan-001', sampleTasks, customChain, flow);
    expect(capturedIndex).toBe(0);
  });
});

describe('getPlanGateFromState', () => {
  test('returns block message when no active plan', () => {
    const state: AgnesRuntimeState = {
      hasActivePlan: false,
      activePlanId: null,
      planContent: null,
      planEntry: null,
    };
    const gate = getPlanGateFromState(state);
    expect(gate).not.toBeNull();
    expect(gate).toContain('PLAN REQUIRED');
  });

  test('returns block message when plan not approved', () => {
    const state: AgnesRuntimeState = {
      hasActivePlan: true,
      activePlanId: 'plan-001',
      planContent: 'Goal: Test',
      planEntry: {
        id: 'plan-001',
        status: 'draft',
        createdAt: '',
        updatedAt: '',
        summary: 'Test',
        total: 1,
        completed: 0,
        blocked: 0,
        file: 'plan-001.yaml',
      },
    };
    const gate = getPlanGateFromState(state);
    expect(gate).not.toBeNull();
    expect(gate).toContain('APPROVAL REQUIRED');
  });

  test('returns null when plan is active and approved', () => {
    const state: AgnesRuntimeState = {
      hasActivePlan: true,
      activePlanId: 'plan-001',
      planContent: 'Goal: Test',
      planEntry: {
        id: 'plan-001',
        status: 'approved',
        createdAt: '',
        updatedAt: '',
        summary: 'Test',
        total: 1,
        completed: 0,
        blocked: 0,
        file: 'plan-001.yaml',
      },
    };
    const gate = getPlanGateFromState(state);
    expect(gate).toBeNull();
  });

  test('returns null when hasActivePlan but no planEntry', () => {
    const state: AgnesRuntimeState = {
      hasActivePlan: true,
      activePlanId: 'plan-001',
      planContent: null,
      planEntry: null,
    };
    const gate = getPlanGateFromState(state);
    expect(gate).toBeNull();
  });
});

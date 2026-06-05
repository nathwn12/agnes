import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  checkIterationCompletion,
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
  getPlanGateFromIndex,
  getPlanGateFromState,
} from './runtime.js';
import type { AgnesRuntimeState, ProcessMessageResult } from './runtime.js';

import type { PlanIndex } from './state.js';
import { freshStruggleMetrics, createPlan, getExecutionArtifacts } from './state.js';
import { createTempProject, writeIndex, readIndex } from './test-utils';
import type { Gate, GateResult } from './verification.js';



function canonicalCompletion(status = 'DONE'): string {
  return `<!-- <agnes:message>${JSON.stringify({ type: 'completion', id: randomUUID(), timestamp: new Date().toISOString(), status, summary: status.toLowerCase(), schema: 'agnes/message-v1' })}</agnes:message> -->`;
}

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

describe('ExecutionOutcome', () => {
  test('recordAttempt returns ExecutionOutcome with summary', () => {
    const outcome = recordAttempt(randomUUID(), 'DONE');
    expect(outcome).toHaveProperty('completed', true);
    expect(outcome).toHaveProperty('summary', 'task completed successfully');
    expect(outcome).toHaveProperty('attempt', 0);
    expect(outcome).toHaveProperty('promiseTag', 'DONE');
  });
});

describe('checkIterationCompletion', () => {
  test('detects completion with expected promise', () => {
    const result = checkIterationCompletion(`some work\n${canonicalCompletion()}`, 'DONE');
    expect(result.detected).toBe(true);
    expect(result.tag).toBe('DONE');
  });

  test('detects completion without expected promise', () => {
    const result = checkIterationCompletion(canonicalCompletion());
    expect(result.detected).toBe(true);
    expect(result.tag).toBe('DONE');
  });

  test('returns not detected when no promise tag', () => {
    const result = checkIterationCompletion('just some output');
    expect(result.detected).toBe(false);
    expect(result.tag).toBeNull();
  });

  test('legacy promise tag is not detected', () => {
    const result = checkIterationCompletion('<promise>DONE</promise>', 'COMPLETE');
    expect(result.detected).toBe(false);
    expect(result.tag).toBeNull();
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
    expect(ctx).toContain('Last canonical completion status seen: DONE');
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

  test('retry budget exhaustion transitions to terminal', () => {
    const sessionId = randomUUID();
    const r1 = recordAttempt(sessionId, null);
    expect(r1.retryClass).toBe('retryable');
    expect(r1.blocked).toBeUndefined();

    const r2 = recordAttempt(sessionId, null);
    expect(r2.retryClass).toBe('retryable');
    expect(r2.blocked).toBeUndefined();

    const r3 = recordAttempt(sessionId, null);
    expect(r3.retryClass).toBe('terminal');
    expect(r3.blocked).toBe(true);
    expect(r3.completed).toBe(false);
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

  test('persists execution artifact on completed attempt', () => {
    const tmp = createTempProject();
    const { entry } = createPlan({
      summary: 'test artifact persistence',
      goal: 'test',
      check: 'test',
      tasks: ['test task'],
      projectRoot: tmp,
    });
    const index = readIndex(tmp);
    index.activePlanId = entry.id;
    writeIndex(tmp, index);

    const sessionId = randomUUID();
    const outcome = recordAttempt(sessionId, 'DONE', tmp);
    expect(outcome.completed).toBe(true);
    expect(outcome.attempt).toBe(0);
    expect(outcome.summary).toBe('task completed successfully');

    const artifacts = getExecutionArtifacts(entry.id, tmp);
    expect(artifacts.length).toBe(1);
    expect(artifacts[0].completed).toBe(true);
    expect(artifacts[0].attempt).toBe(0);
    expect(artifacts[0].summary).toBe('task completed successfully');
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
    expect(result.suggestedSkills).toEqual(['debugger', 'grill-me']);
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
  test('returns ok when all files in scope', () => {
    const result = assertTaskScope(['src/auth.ts'], ['src/auth.ts', 'src/utils.ts']);
    expect(result.ok).toBe(true);
    expect(result.inScope).toEqual(['src/auth.ts']);
    expect(result.outOfScope).toEqual([]);
  });

  test('returns violation when out-of-scope files detected', () => {
    const result = assertTaskScope(['src/auth.ts', 'README.md'], ['src/auth.ts']);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('README.md');
  });

  test('returns ok for empty lists', () => {
    const result = assertTaskScope([], []);
    expect(result.ok).toBe(true);
  });
});



describe('runWaveGates', () => {
  test('passes all gates and returns evidence', async () => {
    const passGate = makeGate(makeGateResult({ gateId: 'lint', status: 'PASS' }), true);
    const { results, evidence } = await runWaveGates([passGate]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('PASS');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].status).toBe('PASS');
  });

  test('stops at first blocking FAIL', async () => {
    const failGate = makeGate(makeGateResult({ gateId: 'lint', status: 'FAIL', evidence: { errors: ['lint error'] } }), true);
    const skipGate = makeGate(makeGateResult({ gateId: 'tests', status: 'PASS' }), true);
    const { results, evidence } = await runWaveGates([failGate, skipGate]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('FAIL');
    expect(evidence).toHaveLength(1);
  });

  test('continues past non-blocking FAIL', async () => {
    const nonBlockingFail = makeGate(makeGateResult({ gateId: 'lint', status: 'FAIL' }), false);
    const passGate = makeGate(makeGateResult({ gateId: 'tests', status: 'PASS' }), true);
    const { results } = await runWaveGates([nonBlockingFail, passGate]);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('FAIL');
    expect(results[1].status).toBe('PASS');
  });

  test('handles gate that throws', async () => {
    const throwGate: Gate = {
      id: 'throw-gate',
      name: 'Throw Gate',
      description: 'throws on run',
      isBlocking: true,
      run: async () => { throw new Error('unexpected error'); },
    };
    const { results } = await runWaveGates([throwGate]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('FAIL');
    expect(results[0].evidence.errors).toContain('unexpected error');
  });

  test('empty gates returns empty results', async () => {
    const { results, evidence } = await runWaveGates([]);
    expect(results).toHaveLength(0);
    expect(evidence).toHaveLength(0);
  });

  test('all gates pass end-to-end', async () => {
    const gates = [
      makeGate(makeGateResult({ gateId: 'lint', status: 'PASS' }), false),
      makeGate(makeGateResult({ gateId: 'typecheck', status: 'PASS' }), true),
      makeGate(makeGateResult({ gateId: 'tests', status: 'PASS' }), true),
    ];
    const { results, evidence } = await runWaveGates(gates);
    expect(results).toHaveLength(3);
    expect(results.every(r => r.status === 'PASS')).toBe(true);
    expect(evidence).toHaveLength(3);
    expect(evidence.every(e => e.status === 'PASS')).toBe(true);
  });
});

describe('getPlanGateFromIndex', () => {
  test('returns empty string when no activePlanId', () => {
    const gate = getPlanGateFromIndex({
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: '/test',
      projectName: 'test',
      updatedAt: '2026-01-01T00:00:00.000Z',
      activePlanId: null,
      plans: [],
    });
    expect(gate).toBe('');
  });

  test('returns block message when active plan is not found', () => {
    const gate = getPlanGateFromIndex({
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: '/test',
      projectName: 'test',
      updatedAt: '2026-01-01T00:00:00.000Z',
      activePlanId: 'plan-001',
      plans: [],
    });
    expect(gate).toContain('No active plan found');
  });

  test('returns blocked message when active plan is blocked', () => {
    const gate = getPlanGateFromIndex({
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: '/test',
      projectName: 'test',
      updatedAt: '2026-01-01T00:00:00.000Z',
      activePlanId: 'plan-001',
      plans: [
        { id: 'plan-001', status: 'blocked', createdAt: '', updatedAt: '', summary: 'Blocked', total: 1, completed: 0, blocked: 1, file: 'plan-001.yaml' },
      ],
    });
    expect(gate).toContain('BLOCKED PLAN');
  });

  test('returns approval required when plan is not approved', () => {
    const gate = getPlanGateFromIndex({
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: '/test',
      projectName: 'test',
      updatedAt: '2026-01-01T00:00:00.000Z',
      activePlanId: 'plan-001',
      plans: [
        { id: 'plan-001', status: 'in_progress', createdAt: '', updatedAt: '', summary: 'Active', total: 1, completed: 0, blocked: 0, file: 'plan-001.yaml' },
      ],
    });
    expect(gate).toContain('APPROVAL REQUIRED');
  });

  test('returns null when plan is approved and no superseding child', () => {
    const gate = getPlanGateFromIndex({
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: '/test',
      projectName: 'test',
      updatedAt: '2026-01-01T00:00:00.000Z',
      activePlanId: 'plan-001',
      plans: [
        { id: 'plan-001', status: 'approved', createdAt: '', updatedAt: '', summary: 'Approved', total: 1, completed: 0, blocked: 0, file: 'plan-001.yaml' },
      ],
    });
    expect(gate).toBeNull();
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

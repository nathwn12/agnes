import { describe, test, expect, afterAll } from 'bun:test';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { createTempProject, writeIndex, readIndex, cleanupTempDirs } from './test-utils';

import { classifyIntent, processMessage, requestMatchesPlan, checkPlanDrift, assertTaskScope, recordAttempt, runWaveGates } from './runtime';
import type { ProcessMessageResult } from './runtime';
import { createAutoPlan, createBuiltinPlan, assessPlanQuality, transitionPlanStatus, createPlan, getExecutionArtifacts } from './state';
import type { PlanIndex } from './state';
import { serializeAgnesMessage, parseAgnesMessage } from './protocol';

import type { Gate } from './verification';

afterAll(() => {
  cleanupTempDirs();
});

function makeCleanIndex(tmp: string): PlanIndex {
  return {
    agnesVersion: '0.7.2',
    schemaVersion: 2,
    projectDir: tmp,
    projectName: path.basename(tmp),
    updatedAt: new Date().toISOString(),
    activePlanId: null,
    plans: [],
  };
}

const highQualityPlan = `schema: agnes/plan-v1
id: plan-001
version: 1
createdAt: 2026-01-01T00:00:00.000Z
updatedAt: 2026-01-01T00:00:00.000Z
status: draft
parent: null
goal: Add dark mode toggle to settings page
check: All tests pass, dark mode toggle works in Chrome/Firefox/Safari, preference survives reload
summary: Add dark mode toggle to settings page
tasks:
  - id: task-001
    summary: Add dark mode CSS variables
    status: pending
    files:
      - Build compiles without errors
    depends_on: []
  - id: task-002
    summary: Create toggle component
    status: pending
    files:
      - Unit test renders and toggles
    depends_on:
      - task-001
  - id: task-003
    summary: Persist preference in localStorage
    status: pending
    files:
      - Preference survives page reload
    depends_on:
      - task-002
  - id: task-004
    summary: Apply theme class to document
    status: pending
    files:
      - Visual regression tests pass
    depends_on:
      - task-001
      - task-002
      - task-003
notes:
  - CSS variables may conflict with existing styles. Verify in all viewports.
`;

describe('planning discipline integration', () => {
  test('Complex implement intent without active plan stays on full planner path', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    expect(classifyIntent('fix the broken login').category).toBe('implement');

    const index = readIndex(tmp)!;
    const result = processMessage('Refactor the database layer', index, null);
    expect(result.type).toBe('proceed');
    if (result.type === 'proceed') {
      expect(result.context).toBe('complex');
    }
    const updatedIndex = readIndex(tmp)!;
    expect(updatedIndex.activePlanId).toBeNull();
  });

  test('Builtin planner creates compact plan for lightweight implement intent', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    const id = createBuiltinPlan({ goal: 'Add error handling to the auth function', source: 'user' }, tmp);
    expect(id).toBe('plan-001');

    const index = readIndex(tmp)!;
    expect(index.activePlanId).toBe(id);
    const entry = index.plans.find((p: PlanIndex['plans'][number]) => p.id === id)!;
    expect(entry.plannerMode).toBe('builtin');
    expect(entry.plannerSource).toBe('user');

    const planContent = fs.readFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'utf8');
    expect(planContent).toContain('plannerMode: builtin');
    expect(planContent).toContain('Verify the result with a focused test or manual check');
  });

  test('createAutoPlan creates draft plan with structured template', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    const id = createAutoPlan({ goal: 'Implement login validation', source: 'gate' }, tmp);
    expect(id).toBe('plan-001');

    const index = readIndex(tmp)!;
    const entry = index.plans.find((p: PlanIndex['plans'][number]) => p.id === id);
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('draft');

    const planContent = fs.readFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'utf8');
    expect(planContent).toContain('goal: Implement login validation');
    expect(planContent).toContain('tasks:');
  });

  test('Quality check blocks poor plans', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    createAutoPlan({ goal: 'Implement login validation', source: 'gate' }, tmp);
    const planContent = fs.readFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'utf8');

    const quality = assessPlanQuality(planContent);
    expect(quality.score).toBeLessThan(60);

    const result = transitionPlanStatus('plan-001', 'reviewed', tmp);
    expect(result).toBeNull();

    const index = readIndex(tmp)!;
    expect(index.plans[0].status).toBe('draft');
  });

  test('Full lifecycle: draft → reviewed → ready → in_progress → done', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    const id = createAutoPlan({ goal: 'Add dark mode toggle to settings page', source: 'user' }, tmp);

    let result = transitionPlanStatus(id, 'reviewed', tmp);
    expect(result).toBeNull();

    const planPath = path.join(tmp, '.agnes', 'plans', 'plan-001.yaml');
    fs.writeFileSync(planPath, highQualityPlan, 'utf8');

    result = transitionPlanStatus(id, 'reviewed', tmp);
    expect(result).not.toBeNull();
    expect(result!.plans.find(p => p.id === id)!.status).toBe('reviewed');

    result = transitionPlanStatus(id, 'ready', tmp);
    expect(result).not.toBeNull();
    expect(result!.plans.find(p => p.id === id)!.status).toBe('ready');

    result = transitionPlanStatus(id, 'in_progress', tmp);
    expect(result).not.toBeNull();
    expect(result!.plans.find(p => p.id === id)!.status).toBe('in_progress');
    expect(result!.activePlanId).toBe(id);

    result = transitionPlanStatus(id, 'done', tmp);
    expect(result).not.toBeNull();
    expect(result!.plans.find(p => p.id === id)!.status).toBe('done');
    expect(result!.activePlanId).toBeNull();

      const planContent = fs.readFileSync(planPath, 'utf8');
      expect(planContent).toContain('schema: agnes/plan-v1');
  });

  test('Invalid transitions are rejected', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    const id = createAutoPlan({ goal: 'Test transitions', source: 'user' }, tmp);
    const planPath = path.join(tmp, '.agnes', 'plans', 'plan-001.yaml');
    fs.writeFileSync(planPath, highQualityPlan, 'utf8');

    expect(transitionPlanStatus(id, 'ready', tmp)).toBeNull();
    expect(transitionPlanStatus(id, 'in_progress', tmp)).toBeNull();
    expect(transitionPlanStatus(id, 'blocked', tmp)).toBeNull();
    expect(transitionPlanStatus(id, 'done', tmp)).toBeNull();

    expect(transitionPlanStatus(id, 'reviewed', tmp)).not.toBeNull();

    expect(transitionPlanStatus(id, 'in_progress', tmp)).toBeNull();
    expect(transitionPlanStatus(id, 'blocked', tmp)).toBeNull();
    expect(transitionPlanStatus(id, 'done', tmp)).toBeNull();

    expect(transitionPlanStatus(id, 'ready', tmp)).not.toBeNull();
    expect(transitionPlanStatus(id, 'in_progress', tmp)).not.toBeNull();

    expect(transitionPlanStatus(id, 'draft', tmp)).toBeNull();
    expect(transitionPlanStatus(id, 'reviewed', tmp)).toBeNull();
    expect(transitionPlanStatus(id, 'ready', tmp)).toBeNull();

    expect(transitionPlanStatus(id, 'done', tmp)).not.toBeNull();
    expect(transitionPlanStatus(id, 'draft', tmp)).toBeNull();
    expect(transitionPlanStatus(id, 'ready', tmp)).toBeNull();
    expect(transitionPlanStatus(id, 'in_progress', tmp)).toBeNull();

    expect(transitionPlanStatus('plan-999', 'done', tmp)).toBeNull();
  });

  test('Gate passes when active plan matches', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    const index: PlanIndex = {
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: path.basename(tmp),
      updatedAt: now,
      activePlanId: 'plan-001',
      plans: [{
        id: 'plan-001',
        status: 'approved',
        createdAt: now,
        updatedAt: now,
        summary: 'Fix login bug',
        total: 1,
        completed: 0,
        blocked: 0,
        file: 'plan-001.yaml',
      }],
    };
    writeIndex(tmp, index);

    const planContent = 'Plan to fix the login bug';
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), planContent, 'utf8');

    const result = processMessage('fix the login', index, planContent) as Extract<ProcessMessageResult, { type: 'proceed' }>;
    expect(result.type).toBe('proceed');
    expect(result.intent).toBe('implement');
  });

  test('requestMatchesPlan matching', () => {
    expect(requestMatchesPlan('fix login', 'Implement login validation for the settings page')).toBe(true);
    expect(requestMatchesPlan('add export feature', 'Fix login bug on settings')).toBe(false);
    expect(requestMatchesPlan('', 'Some plan content')).toBe(false);
  });

  test('Drift detection', () => {
    const { outOfScope } = checkPlanDrift(['src/login.ts', 'src/settings.ts'], ['src/login.ts']);
    expect(outOfScope).toEqual(['src/settings.ts']);

    expect(assertTaskScope(['src/login.ts'], ['src/login.ts']).ok).toBe(true);
    expect(assertTaskScope(['src/login.ts', 'src/settings.ts'], ['src/login.ts']).ok).toBe(false);
  });

  test('Edge cases: missing index, NaN dates, empty scope', () => {
    const result = processMessage('Refactor the database layer', null, null);
    expect(result.type).toBe('proceed');
    if (result.type === 'proceed') {
      expect(result.context).toBe('complex');
    }

    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    expect(transitionPlanStatus('plan-999', 'done', tmp)).toBeNull();

    expect(assertTaskScope(['src/login.ts'], []).ok).toBe(false);
  });
});

describe('harness renovation integration', () => {
  test('execution artifacts are persisted through completed recordAttempt', () => {
    const tmp = createTempProject();
    const { entry } = createPlan({
      summary: 'integration test artifacts',
      goal: 'test artifact persistence in integration',
      check: 'test',
      tasks: ['execute task', 'verify result'],
      projectRoot: tmp,
    });
    const index = readIndex(tmp);
    index.activePlanId = entry.id;
    writeIndex(tmp, index);

    const sessionId = randomUUID();
    const outcome = recordAttempt(sessionId, 'DONE', tmp);
    expect(outcome.completed).toBe(true);
    expect(outcome.attempt).toBe(0);

    const artifacts = getExecutionArtifacts(entry.id, tmp);
    expect(artifacts.length).toBe(1);
    expect(artifacts[0].completed).toBe(true);
    expect(artifacts[0].summary).toBe('task completed successfully');
  });

  test('retry budget exhaustion produces blocked artifact', () => {
    const tmp = createTempProject();
    const { entry } = createPlan({
      summary: 'retry budget integration test',
      goal: 'test retry budget exhaustion',
      check: 'test',
      tasks: ['attempt task'],
      projectRoot: tmp,
    });
    const index = readIndex(tmp);
    index.activePlanId = entry.id;
    writeIndex(tmp, index);

    const sessionId = randomUUID();
    let lastOutcome: ReturnType<typeof recordAttempt> | undefined;
    for (let i = 0; i < 3; i++) {
      lastOutcome = recordAttempt(sessionId, null, tmp);
    }

    expect(lastOutcome!.blocked).toBe(true);
    expect(lastOutcome!.retryClass).toBe('terminal');
    expect(lastOutcome!.summary).toContain('retry budget');

    // autoBlockPlan creates a new iteration and sets activePlanId to it
    // The terminal artifact is persisted under that new plan's file
    const updatedIndex = readIndex(tmp);
    expect(updatedIndex).not.toBeNull();

    // Find the terminal artifact across all plan files
    let terminalArtifact: any = undefined;
    for (const plan of (updatedIndex as any).plans) {
      const artifacts = getExecutionArtifacts(plan.id, tmp);
      terminalArtifact = artifacts.find((a: any) => a.retryClass === 'terminal');
      if (terminalArtifact) break;
    }
    expect(terminalArtifact).toBeDefined();
    expect(terminalArtifact!.completed).toBe(false);
  });

  test('protocol message normalization round-trips through schema', () => {
    const msg = serializeAgnesMessage({
      type: 'result',
      taskId: 'task-001',
      status: 'DONE',
      summary: 'Task completed successfully',
    });
    expect(msg).toContain('<agnes:message>');
    expect(msg).toContain('"schema":"agnes/message-v1"');
    expect(msg).toContain('"status":"DONE"');

    const parsed = parseAgnesMessage(msg);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.type).toBe('result');
      if (parsed.type === 'result') {
        expect(parsed.status).toBe('DONE');
      }
    }
  });

  test('gate evidence feeds into execution outcome', () => {
    const tmp = createTempProject();
    const passingGate: Gate = {
      id: 'integration-test-gate',
      name: 'Integration Test Gate',
      description: 'A test gate that always passes',
      isBlocking: true,
      run: async () => ({
        gateId: 'integration-test-gate',
        status: 'PASS' as const,
        evidence: { errors: [] },
        timestamp: new Date().toISOString(),
        durationMs: 5,
      }),
    };

    return runWaveGates([passingGate]).then(({ results, evidence }) => {
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('PASS');
      expect(evidence.length).toBe(1);
      expect(evidence[0].status).toBe('PASS');
      expect(evidence[0].gateId).toBe('integration-test-gate');
    });
  });
});

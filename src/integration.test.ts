import { describe, test, expect, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { createTempProject, writeIndex, readIndex, cleanupTempDirs } from './test-utils';

import { classifyIntent, processMessage, requestMatchesPlan, checkPlanDrift, assertTaskScope } from './runtime';
import type { ProcessMessageResult } from './runtime';
import { createAutoPlan, createBuiltinPlan, assessPlanQuality, transitionPlanStatus } from './state';
import type { PlanIndex } from './state';

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

    expect(() => assertTaskScope(['src/login.ts'], ['src/login.ts'])).not.toThrow();
    expect(() => assertTaskScope(['src/login.ts', 'src/settings.ts'], ['src/login.ts'])).toThrow();
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

    expect(() => assertTaskScope(['src/login.ts'], [])).toThrow();
  });
});

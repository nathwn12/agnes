import { describe, test, expect, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { createTempProject, writeIndex, readIndex, cleanupTempDirs } from './test-utils';

import { classifyIntent, processMessage, requestMatchesPlan, checkPlanDrift, assertTaskScope } from './runtime';
import type { ProcessMessageResult } from './runtime';
import { createAutoPlan, assessPlanQuality, transitionPlanStatus } from './state';
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

const highQualityPlan = `# plan-001 — Add dark mode toggle to settings page

## Intent
Users can toggle dark mode on the settings page and the preference persists across sessions

## Goal
Add dark mode toggle to settings page

## Tasks
| # | Task | Dependencies | Effort | Verification |
|---|------|-------------|--------|-------------|
| 1 | Add dark mode CSS variables |  | M | Build compiles without errors |
| 2 | Create toggle component | 1 | M | Unit test renders and toggles |
| 3 | Persist preference in localStorage | 2 | S | Preference survives page reload |
| 4 | Apply theme class to document | 1, 2, 3 | S | Visual regression tests pass |

## Risks
CSS variables may conflict with existing styles. Verify in all viewports.

## Completion Criteria
All tests pass, dark mode toggle works in Chrome/Firefox/Safari, preference survives reload

## Validation
Manual smoke test: toggle dark mode, reload page, verify preference persists
`;

describe('planning discipline integration', () => {
  test('Gate blocks implement intent without active plan', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    expect(classifyIntent('fix the broken login').category).toBe('implement');

    const index = readIndex(tmp)!;
    const result = processMessage('fix the broken login', index, null) as Extract<ProcessMessageResult, { type: 'block' }>;
    expect(result.type).toBe('block');
    expect(result.reason).toBe('no_active_plan');
  });

  test('createAutoPlan creates draft plan with structured template', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    const id = createAutoPlan({ goal: 'Implement login validation', source: 'gate' }, tmp);
    expect(id).toBe('plan-001');

    const index = readIndex(tmp)!;
    const entry = index.plans.find(p => p.id === id);
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('draft');

    const planContent = fs.readFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.md'), 'utf8');
    expect(planContent).toContain('## Intent');
    expect(planContent).toContain('## Goal');
    expect(planContent).toContain('## Tasks');
    expect(planContent).toContain('## Risks');
    expect(planContent).toContain('## Completion Criteria');
    expect(planContent).toContain('## Validation');
  });

  test('Quality check blocks poor plans', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    createAutoPlan({ goal: 'Implement login validation', source: 'gate' }, tmp);
    const planContent = fs.readFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.md'), 'utf8');

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

    const planPath = path.join(tmp, '.agnes', 'plans', 'plan-001.md');
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
    expect(planContent).toContain('Retrospective for plan-001');
  });

  test('Invalid transitions are rejected', () => {
    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    const id = createAutoPlan({ goal: 'Test transitions', source: 'user' }, tmp);
    const planPath = path.join(tmp, '.agnes', 'plans', 'plan-001.md');
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
        status: 'in_progress',
        createdAt: now,
        updatedAt: now,
        summary: 'Fix login bug',
        total: 1,
        completed: 0,
        blocked: 0,
        file: 'plan-001.md',
      }],
    };
    writeIndex(tmp, index);

    const planContent = 'Plan to fix the login bug';
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.md'), planContent, 'utf8');

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
    const result = processMessage('fix the login', null, null);
    expect(result).toEqual({
      type: 'block',
      reason: 'no_active_plan',
      message: 'I need a plan before I can implement. Do you have a plan in mind?',
    });

    const tmp = createTempProject();
    writeIndex(tmp, makeCleanIndex(tmp));

    expect(transitionPlanStatus('plan-999', 'done', tmp)).toBeNull();

    expect(() => assertTaskScope(['src/login.ts'], [])).toThrow();
  });
});

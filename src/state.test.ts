import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  findProjectRoot,
  cacheDir,
  readPlanIndex,
  writePlanIndex,
  getLatestActivePlan,
  buildPlanSummary,
  getNextPlanId,
  createPlan,
  createPlanIteration,
  updatePlanStatus,
} from './state.js';
import type { PlanIndex, ActivePlan } from './state.js';
import { getPlanState, getPlanGate, getCurrentState, getPlanGateFromState } from './runtime.js';
import type { AgnesRuntimeState } from './runtime.js';

function createTempProject(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
  fs.mkdirSync(path.join(tmp, '.cache', 'agnes'), { recursive: true });
  return tmp;
}

function writeIndex(projectRoot: string, index: PlanIndex): void {
  const indexPath = path.join(projectRoot, '.cache', 'agnes', 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index), 'utf8');
}

function readIndex(projectRoot: string): PlanIndex | null {
  const indexPath = path.join(projectRoot, '.cache', 'agnes', 'index.json');
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8')) as PlanIndex;
  } catch {
    return null;
  }
}

describe('findProjectRoot', () => {
  test('returns null when no .cache/agnes/index.json exists', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    expect(findProjectRoot(tmp)).toBeNull();
  });

  test('finds project root when .cache/agnes/index.json exists', () => {
    const tmp = createTempProject();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: new Date().toISOString(),
      activePlanId: null,
      plans: [],
    });
    expect(findProjectRoot(tmp)).toBe(tmp);
  });

  test('walks up from subdirectory to find root', () => {
    const tmp = createTempProject();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: new Date().toISOString(),
      activePlanId: null,
      plans: [],
    });
    const subdir = path.join(tmp, 'src', 'components');
    fs.mkdirSync(subdir, { recursive: true });
    expect(findProjectRoot(subdir)).toBe(tmp);
  });
});

describe('cacheDir', () => {
  test('returns path for explicit root', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    expect(cacheDir(tmp)).toBe(path.join(tmp, '.cache', 'agnes'));
  });

  test('returns path for existing temporary root even without index', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    expect(cacheDir(tmp)).toBe(path.join(tmp, '.cache', 'agnes'));
  });
});

describe('readPlanIndex / writePlanIndex', () => {
  test('readPlanIndex returns null for missing index', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    expect(readPlanIndex(tmp)).toBeNull();
  });

  test('readPlanIndex returns null for corrupt index', () => {
    const tmp = createTempProject();
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'index.json'), 'not json', 'utf8');
    expect(readPlanIndex(tmp)).toBeNull();
  });

  test('writePlanIndex creates index.json atomically', () => {
    const tmp = createTempProject();
    const index: PlanIndex = {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: new Date().toISOString(),
      activePlanId: null,
      plans: [],
    };
    writePlanIndex(index, tmp);
    const read = readPlanIndex(tmp);
    expect(read).not.toBeNull();
    expect(read!.agnesVersion).toBe('0.4.4');
    expect(read!.plans).toEqual([]);
  });
});

describe('getLatestActivePlan', () => {
  test('returns null when no index', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    expect(getLatestActivePlan(tmp)).toBeNull();
  });

  test('returns null when no active plans', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: null,
      plans: [{
        id: 'plan-001',
        status: 'done',
        createdAt: now,
        updatedAt: now,
        summary: 'Done plan',
        total: 1,
        completed: 1,
        blocked: 0,
        file: 'plan-001.md',
      }],
    });
    expect(getLatestActivePlan(tmp)).toBeNull();
  });

  test('returns active plan by activePlanId', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    const entry = {
      id: 'plan-001',
      status: 'in_progress' as const,
      createdAt: now,
      updatedAt: now,
      summary: 'Active plan',
      total: 2,
      completed: 1,
      blocked: 0,
      file: 'plan-001.md',
    };
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: 'plan-001',
      plans: [entry],
    });
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'plan-001.md'), '# Plan content', 'utf8');
    const active = getLatestActivePlan(tmp);
    expect(active).not.toBeNull();
    expect(active!.entry.id).toBe('plan-001');
    expect(active!.content).toBe('# Plan content');
  });
});

describe('buildPlanSummary', () => {
  test('returns no-plan message when no project root', () => {
    expect(buildPlanSummary(fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-')))).toBe('No active plan. Create one before delegating work.');
  });

  test('returns no-plan message when no plans exist', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: null,
      plans: [],
    });
    expect(buildPlanSummary(tmp)).toBe('No active plan. Create one before delegating work.');
  });

  test('returns summary for active plan', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: 'plan-001',
      plans: [{
        id: 'plan-001',
        status: 'in_progress',
        createdAt: now,
        updatedAt: now,
        summary: 'Active plan',
        total: 3,
        completed: 1,
        blocked: 0,
        file: 'plan-001.md',
      }],
    });
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'plan-001.md'), 'Goal: Test the system\n\nTasks:\n- [x] one\n- [ ] two\n- [ ] three', 'utf8');
    const summary = buildPlanSummary(tmp);
    expect(summary).toContain('Active Plan: plan-001');
    expect(summary).toContain('in_progress');
    expect(summary).toContain('1/3 tasks done');
    expect(summary).toContain('Goal: Test the system');
  });
});

describe('getNextPlanId', () => {
  test('returns plan-001 when no cache dir', () => {
    expect(getNextPlanId(fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-')))).toBe('plan-001');
  });

  test('returns plan-001 when cache dir exists but empty', () => {
    const tmp = createTempProject();
    expect(getNextPlanId(tmp)).toBe('plan-001');
  });

  test('increments from existing plan files', () => {
    const tmp = createTempProject();
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'plan-001.md'), '', 'utf8');
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'plan-003.md'), '', 'utf8');
    expect(getNextPlanId(tmp)).toBe('plan-004');
  });

  test('ignores non-plan files', () => {
    const tmp = createTempProject();
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'plan-001.md'), '', 'utf8');
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'index.json'), '{}', 'utf8');
    expect(getNextPlanId(tmp)).toBe('plan-002');
  });

  test('plan file writes leave no .tmp file after success', () => {
    const tmp = createTempProject();
    createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      projectRoot: tmp,
    });
    const planPath = path.join(tmp, '.cache', 'agnes', 'plan-001.md');
    expect(fs.existsSync(planPath)).toBe(true);
    const tmpFiles = fs.readdirSync(path.join(tmp, '.cache', 'agnes'))
      .filter(f => f.endsWith('.tmp'));
    expect(tmpFiles).toEqual([]);
  });
});

describe('createPlan', () => {
  test('creates plan file and index entry', () => {
    const tmp = createTempProject();
    const active = createPlan({
      summary: 'Test plan',
      goal: 'Complete the test',
      check: 'bun test passes',
      tasks: ['Write tests', 'Refactor code'],
      projectRoot: tmp,
    });
    expect(active.entry.id).toBe('plan-001');
    expect(active.entry.status).toBe('draft');
    expect(active.entry.total).toBe(2);
    expect(active.entry.completed).toBe(0);

    const index = readIndex(tmp)!;
    expect(index.plans.length).toBe(1);
    expect(index.activePlanId).toBe('plan-001');

    const planPath = path.join(tmp, '.cache', 'agnes', 'plan-001.md');
    expect(fs.existsSync(planPath)).toBe(true);
    const content = fs.readFileSync(planPath, 'utf8');
    expect(content).toContain('Goal: Complete the test');
    expect(content).toContain('Check: bun test passes');
    expect(content).toContain('- [ ] Write tests');
    expect(content).toContain('- [ ] Refactor code');
  });

  test('accepts explicit status', () => {
    const tmp = createTempProject();
    const active = createPlan({
      summary: 'Quick plan',
      goal: 'Do something',
      check: 'check',
      tasks: ['Task 1'],
      status: 'in_progress',
      projectRoot: tmp,
    });
    expect(active.entry.status).toBe('in_progress');
  });

  test('preserves existing [x] and [/] markers in tasks', () => {
    const tmp = createTempProject();
    const active = createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'Check',
      tasks: ['- [x] Completed', '- [/] Blocked', '- [ ] Pending'],
      projectRoot: tmp,
    });
    const content = fs.readFileSync(path.join(tmp, '.cache', 'agnes', `${active.entry.id}.md`), 'utf8');
    expect(content).toContain('- [x] Completed');
    expect(content).toContain('- [/] Blocked');
    expect(content).toContain('- [ ] Pending');
  });

  test('createPlan with done status does not set activePlanId', () => {
    const tmp = createTempProject();
    const active = createPlan({
      summary: 'Done plan',
      goal: 'Done',
      check: 'check',
      tasks: ['Task 1'],
      status: 'done',
      projectRoot: tmp,
    });
    expect(active.entry.status).toBe('done');
    const index = readIndex(tmp)!;
    expect(index.activePlanId).toBeNull();
  });
});

describe('createPlanIteration', () => {
  test('creates iteration with parent reference', () => {
    const tmp = createTempProject();
    const parent = createPlan({
      summary: 'Parent plan',
      goal: 'Parent goal',
      check: 'check',
      tasks: ['Task 1'],
      projectRoot: tmp,
    });

    const iteration = createPlanIteration({
      parent: parent.entry.id,
      summary: 'Iteration 2',
      goal: 'Parent goal',
      check: 'check',
      tasksMarkdown: '- [x] Task 1\n- [ ] Task 2',
      status: 'in_progress',
      completed: 1,
      blocked: 0,
      projectRoot: tmp,
    });

    expect(iteration.entry.id).toBe('plan-002');
    expect(iteration.entry.parent).toBe('plan-001');
    expect(iteration.entry.completed).toBe(1);
    expect(iteration.entry.total).toBe(2);

    const index = readIndex(tmp)!;
    expect(index.activePlanId).toBe('plan-002');
  });

  test('does not set activePlanId for terminal statuses', () => {
    const tmp = createTempProject();
    const parent = createPlan({
      summary: 'Parent',
      goal: 'Parent',
      check: 'check',
      tasks: ['Task'],
      projectRoot: tmp,
    });

    createPlanIteration({
      parent: parent.entry.id,
      summary: 'Done',
      goal: 'Done',
      check: 'check',
      tasksMarkdown: '- [x] Task',
      status: 'done',
      completed: 1,
      blocked: 0,
      projectRoot: tmp,
    });

    const index = readIndex(tmp)!;
    expect(index.activePlanId).toBeNull();
  });

  test('createPlanIteration marks parent abandoned when creating child', () => {
    const tmp = createTempProject();
    const parent = createPlan({
      summary: 'Parent',
      goal: 'Parent goal',
      check: 'check',
      tasks: ['Task 1'],
      projectRoot: tmp,
    });

    createPlanIteration({
      parent: parent.entry.id,
      summary: 'Child',
      goal: 'Child goal',
      check: 'check',
      tasksMarkdown: '- [x] Task 1\n- [ ] Task 2',
      status: 'in_progress',
      completed: 1,
      blocked: 0,
      projectRoot: tmp,
    });

    const index = readIndex(tmp)!;
    const parentEntry = index.plans.find(p => p.id === parent.entry.id);
    expect(parentEntry).not.toBeNull();
    expect(parentEntry!.status).toBe('abandoned');
    expect(index.activePlanId).toBe('plan-002');
  });
});

describe('updatePlanStatus', () => {
  test('updates status and counts', () => {
    const tmp = createTempProject();
    createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1', 'Task 2'],
      projectRoot: tmp,
    });

    const updated = updatePlanStatus({
      id: 'plan-001',
      status: 'in_progress',
      completed: 1,
      projectRoot: tmp,
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('in_progress');
    expect(updated!.completed).toBe(1);

    const index = readIndex(tmp)!;
    expect(index.plans[0].status).toBe('in_progress');
    expect(index.plans[0].completed).toBe(1);
  });

  test('returns null for nonexistent plan', () => {
    const tmp = createTempProject();
    const result = updatePlanStatus({
      id: 'plan-999',
      status: 'done',
      projectRoot: tmp,
    });
    expect(result).toBeNull();
  });

  test('updatePlanStatus(done) clears activePlanId when plan is active', () => {
    const tmp = createTempProject();
    createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      status: 'in_progress',
      projectRoot: tmp,
    });

    const index = readIndex(tmp)!;
    expect(index.activePlanId).toBe('plan-001');

    updatePlanStatus({
      id: 'plan-001',
      status: 'done',
      completed: 1,
      projectRoot: tmp,
    });

    const updated = readIndex(tmp)!;
    expect(updated.activePlanId).toBeNull();
  });

  test('updatePlanStatus(in_progress) sets activePlanId', () => {
    const tmp = createTempProject();
    createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      projectRoot: tmp,
    });

    let index = readIndex(tmp)!;
    expect(index.activePlanId).toBe('plan-001');

    updatePlanStatus({
      id: 'plan-001',
      status: 'done',
      completed: 1,
      projectRoot: tmp,
    });

    index = readIndex(tmp)!;
    expect(index.activePlanId).toBeNull();

    updatePlanStatus({
      id: 'plan-001',
      status: 'in_progress',
      completed: 1,
      projectRoot: tmp,
    });

    index = readIndex(tmp)!;
    expect(index.activePlanId).toBe('plan-001');
  });
});

describe('getPlanState', () => {
  test('returns no-index state when no project root', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    const state = getPlanState(tmp);
    expect(state.hasActivePlan).toBe(false);
    expect(state.activePlan).toBeNull();
    expect(state.planIndex).toBeNull();
    expect(state.latestId).toBeNull();
  });

  test('returns no-active-plan state when index exists but empty', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: null,
      plans: [],
    });
    const state = getPlanState(tmp);
    expect(state.hasActivePlan).toBe(false);
    expect(state.activePlan).toBeNull();
    expect(state.planIndex).not.toBeNull();
    expect(state.latestId).toBeNull();
  });

  test('returns active plan state', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: 'plan-001',
      plans: [{
        id: 'plan-001',
        status: 'in_progress',
        createdAt: now,
        updatedAt: now,
        summary: 'Active plan',
        total: 2,
        completed: 1,
        blocked: 0,
        file: 'plan-001.md',
      }],
    });
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'plan-001.md'), 'Goal: Test\n\nTasks:\n- [x] one\n- [ ] two', 'utf8');
    const state = getPlanState(tmp);
    expect(state.hasActivePlan).toBe(true);
    expect(state.activePlan).not.toBeNull();
    expect(state.activePlan!.entry.id).toBe('plan-001');
    expect(state.planIndex).not.toBeNull();
    expect(state.latestId).toBe('plan-001');
  });
});

describe('getPlanGate', () => {
  test('returns warning when no index found', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    const gate = getPlanGate(tmp);
    expect(gate).toContain('PLAN REQUIRED');
  });

  test('returns warning when no active plan', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: null,
      plans: [{
        id: 'plan-001',
        status: 'done',
        createdAt: now,
        updatedAt: now,
        summary: 'Done plan',
        total: 1,
        completed: 1,
        blocked: 0,
        file: 'plan-001.md',
      }],
    });
    const gate = getPlanGate(tmp);
    expect(gate).toContain('No active plan');
  });

  test('returns null when active plan exists', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: 'plan-001',
      plans: [{
        id: 'plan-001',
        status: 'in_progress',
        createdAt: now,
        updatedAt: now,
        summary: 'Active plan',
        total: 1,
        completed: 0,
        blocked: 0,
        file: 'plan-001.md',
      }],
    });
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'plan-001.md'), 'Goal: Test', 'utf8');
    expect(getPlanGate(tmp)).toBeNull();
  });

  test('returns BLOCKED PLAN when active plan is blocked', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    writeIndex(tmp, {
      agnesVersion: '0.4.4',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: 'plan-001',
      plans: [{
        id: 'plan-001',
        status: 'blocked',
        createdAt: now,
        updatedAt: now,
        summary: 'Blocked plan',
        total: 1,
        completed: 0,
        blocked: 1,
        file: 'plan-001.md',
      }],
    });
    fs.writeFileSync(path.join(tmp, '.cache', 'agnes', 'plan-001.md'), 'Goal: Test', 'utf8');
    const gate = getPlanGate(tmp);
    expect(gate).toContain('BLOCKED PLAN');
    expect(gate).toContain('plan-001');
  });
});

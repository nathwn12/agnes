import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  findProjectRoot,
  resetProjectRootCache,
  cacheDir,
  readPlanIndex,
  writePlanIndex,
  getLatestActivePlan,
  buildPlanSummary,
  getNextPlanId,
  createPlan,
  createPlanIteration,
  updatePlanStatus,
  detectPromiseTag,
  extractPromiseTag,
  freshStruggleMetrics,
  updateStruggleMetrics,
  detectStruggle,
} from './state.js';
import type { PlanIndex, ActivePlan, StruggleMetrics } from './state.js';
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
  test('reset helper clears cached no-arg root', () => {
    resetProjectRootCache();
    expect(true).toBe(true);
  });

  test('returns null when no .cache/agnes/index.json exists', () => {
    resetProjectRootCache();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    expect(findProjectRoot(tmp)).toBeNull();
  });

  test('finds project root when .cache/agnes/index.json exists', () => {
    resetProjectRootCache();
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
    resetProjectRootCache();
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

  test('does not cache misses for later no-arg lookups', () => {
    resetProjectRootCache();
    const originalCwd = process.cwd();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    const nested = path.join(tmp, 'nested');
    fs.mkdirSync(nested, { recursive: true });

    try {
      process.chdir(nested);
      expect(findProjectRoot()).toBeNull();

      fs.mkdirSync(path.join(tmp, '.cache', 'agnes'), { recursive: true });
      writeIndex(tmp, {
        agnesVersion: '0.7.1',
        schemaVersion: 2,
        projectDir: tmp,
        projectName: 'test',
        updatedAt: new Date().toISOString(),
        activePlanId: null,
        plans: [],
      });

      expect(findProjectRoot()).toBe(tmp);
    } finally {
      process.chdir(originalCwd);
      resetProjectRootCache();
    }
  });

  test('invalidates cached no-arg root when index disappears', () => {
    resetProjectRootCache();
    const originalCwd = process.cwd();
    const tmp = createTempProject();
    writeIndex(tmp, {
      agnesVersion: '0.7.1',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: new Date().toISOString(),
      activePlanId: null,
      plans: [],
    });

    try {
      process.chdir(tmp);
      expect(findProjectRoot()).toBe(tmp);
      fs.rmSync(path.join(tmp, '.cache'), { recursive: true, force: true });
      expect(findProjectRoot()).toBeNull();
    } finally {
      process.chdir(originalCwd);
      resetProjectRootCache();
    }
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

  test('readPlanIndex returns null for invalid schema shape', () => {
    const tmp = createTempProject();
    fs.writeFileSync(
      path.join(tmp, '.cache', 'agnes', 'index.json'),
      JSON.stringify({ schemaVersion: 2, projectDir: tmp, activePlanId: null, plans: 'bad' }),
      'utf8',
    );
    expect(readPlanIndex(tmp)).toBeNull();
  });

  test('writePlanIndex creates index.json atomically', () => {
    const tmp = createTempProject();
    const index: PlanIndex = {
      agnesVersion: '0.7.1',
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
    expect(read!.agnesVersion).toBe('0.7.1');
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

describe('state synchronization invariants', () => {
  test('plan markdown file has no runtime state in frontmatter (createPlan)', () => {
    const tmp = createTempProject();
    createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      status: 'in_progress',
      projectRoot: tmp,
    });
    const content = fs.readFileSync(path.join(tmp, '.cache', 'agnes', 'plan-001.md'), 'utf8');
    expect(content).not.toMatch(/^status:/m);
    expect(content).not.toMatch(/^total:/m);
    expect(content).not.toMatch(/^completed:/m);
    expect(content).not.toMatch(/^blocked:/m);
    expect(content).toMatch(/^id: plan-001/m);
    expect(content).toMatch(/^createdAt:/m);
  });

  test('plan markdown file has no runtime state in frontmatter (createPlanIteration)', () => {
    const tmp = createTempProject();
    const parent = createPlan({
      summary: 'Parent',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      status: 'in_progress',
      projectRoot: tmp,
    });
    createPlanIteration({
      parent: parent.entry.id,
      summary: 'Child',
      goal: 'Goal',
      check: 'check',
      tasksMarkdown: '- [x] Task 1',
      status: 'in_progress',
      completed: 1,
      blocked: 0,
      projectRoot: tmp,
    });
    const content = fs.readFileSync(path.join(tmp, '.cache', 'agnes', 'plan-002.md'), 'utf8');
    expect(content).not.toMatch(/^status:/m);
    expect(content).not.toMatch(/^total:/m);
    expect(content).not.toMatch(/^completed:/m);
    expect(content).not.toMatch(/^blocked:/m);
  });

  test('plan file contains narrative content after frontmatter', () => {
    const tmp = createTempProject();
    createPlan({
      summary: 'Test',
      goal: 'Build the feature',
      check: 'bun test',
      tasks: ['Task 1', 'Task 2'],
      projectRoot: tmp,
    });
    const content = fs.readFileSync(path.join(tmp, '.cache', 'agnes', 'plan-001.md'), 'utf8');
    expect(content).toContain('Goal: Build the feature');
    expect(content).toContain('Check: bun test');
    expect(content).toContain('- [ ] Task 1');
    expect(content).toContain('- [ ] Task 2');
  });

  test('index.json is sole source of runtime state', () => {
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
    const planEntry = index.plans[0];
    expect(planEntry.status).toBe('in_progress');
    expect(planEntry.total).toBe(1);
    expect(planEntry.completed).toBe(0);
    expect(planEntry.blocked).toBe(0);
    expect(index.activePlanId).toBe('plan-001');
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

describe('detectPromiseTag', () => {
  test('detects promise tag in output', () => {
    expect(detectPromiseTag('some output\n<promise>DONE</promise>\nmore')).toBe(true);
  });

  test('returns false when no promise tag', () => {
    expect(detectPromiseTag('no promise here')).toBe(false);
  });

  test('matches exact expected tag', () => {
    expect(detectPromiseTag('<promise>DONE</promise>', 'DONE')).toBe(true);
  });

  test('rejects wrong expected tag', () => {
    expect(detectPromiseTag('<promise>DONE</promise>', 'FAIL')).toBe(false);
  });

  test('tolerates whitespace around tag value', () => {
    expect(detectPromiseTag('<promise>  DONE  </promise>', 'DONE')).toBe(true);
  });

  test('accepts any tag when no expected value given', () => {
    expect(detectPromiseTag('<promise>ANYTHING</promise>')).toBe(true);
  });
});

describe('extractPromiseTag', () => {
  test('extracts promise tag value', () => {
    expect(extractPromiseTag('<promise>DONE</promise>')).toBe('DONE');
  });

  test('returns null when no tag', () => {
    expect(extractPromiseTag('no tag')).toBeNull();
  });

  test('extracts first tag when multiple', () => {
    expect(extractPromiseTag('<promise>FIRST</promise> more <promise>SECOND</promise>')).toBe('FIRST');
  });
});

describe('freshStruggleMetrics', () => {
  test('returns zeroed state', () => {
    const m = freshStruggleMetrics();
    expect(m.noProgressIterations).toBe(0);
    expect(m.shortIterations).toBe(0);
    expect(m.repeatedErrors).toEqual({});
    expect(m.lastPromiseTag).toBeNull();
  });
});

describe('updateStruggleMetrics', () => {
  test('increments noProgressIterations when no progress', () => {
    const m = freshStruggleMetrics();
    const updated = updateStruggleMetrics(m, { hadProgress: false, durationMs: 60000, errors: [], promiseTag: null });
    expect(updated.noProgressIterations).toBe(1);
  });

  test('resets noProgressIterations on progress', () => {
    const m = freshStruggleMetrics();
    const afterNoProgress = updateStruggleMetrics(m, { hadProgress: false, durationMs: 60000, errors: [], promiseTag: null });
    const afterProgress = updateStruggleMetrics(afterNoProgress, { hadProgress: true, durationMs: 60000, errors: [], promiseTag: null });
    expect(afterProgress.noProgressIterations).toBe(0);
  });

  test('accumulates short iterations under 30s', () => {
    const m = freshStruggleMetrics();
    const r1 = updateStruggleMetrics(m, { hadProgress: true, durationMs: 10000, errors: [], promiseTag: null });
    expect(r1.shortIterations).toBe(1);
    const r2 = updateStruggleMetrics(r1, { hadProgress: true, durationMs: 5000, errors: [], promiseTag: null });
    expect(r2.shortIterations).toBe(2);
  });

  test('resets short iterations on long iteration', () => {
    const m = freshStruggleMetrics();
    const afterShort = updateStruggleMetrics(m, { hadProgress: true, durationMs: 10000, errors: [], promiseTag: null });
    const afterLong = updateStruggleMetrics(afterShort, { hadProgress: true, durationMs: 60000, errors: [], promiseTag: null });
    expect(afterLong.shortIterations).toBe(0);
  });

  test('counts repeated errors by truncated key', () => {
    const m = freshStruggleMetrics();
    const r1 = updateStruggleMetrics(m, { hadProgress: true, durationMs: 60000, errors: ['Error: something failed'], promiseTag: null });
    expect(r1.repeatedErrors['Error: something failed']).toBe(1);
    const r2 = updateStruggleMetrics(r1, { hadProgress: true, durationMs: 60000, errors: ['Error: something failed'], promiseTag: null });
    expect(r2.repeatedErrors['Error: something failed']).toBe(2);
  });

  test('preserves repeatedErrors across clean iterations', () => {
    const m = freshStruggleMetrics();
    const withErrors = updateStruggleMetrics(m, { hadProgress: true, durationMs: 60000, errors: ['Error: x'], promiseTag: null });
    const withoutErrors = updateStruggleMetrics(withErrors, { hadProgress: true, durationMs: 60000, errors: [], promiseTag: null });
    expect(withoutErrors.repeatedErrors).toEqual({ 'Error: x': 1 });
  });

  test('preserves lastPromiseTag', () => {
    const m = freshStruggleMetrics();
    const updated = updateStruggleMetrics(m, { hadProgress: true, durationMs: 60000, errors: [], promiseTag: 'DONE' });
    expect(updated.lastPromiseTag).toBe('DONE');
  });

  test('keeps previous promiseTag when new one is null', () => {
    const m = freshStruggleMetrics();
    const withTag = updateStruggleMetrics(m, { hadProgress: true, durationMs: 60000, errors: [], promiseTag: 'DONE' });
    const withoutTag = updateStruggleMetrics(withTag, { hadProgress: true, durationMs: 60000, errors: [], promiseTag: null });
    expect(withoutTag.lastPromiseTag).toBe('DONE');
  });
});

describe('detectStruggle', () => {
  test('warns on noProgressIterations >= 3', () => {
    const m: StruggleMetrics = { noProgressIterations: 3, shortIterations: 0, repeatedErrors: {}, lastPromiseTag: null };
    expect(detectStruggle(m)).toEqual(
      expect.arrayContaining([expect.stringMatching(/no progress/i)])
    );
  });

  test('warns on shortIterations >= 3', () => {
    const m: StruggleMetrics = { noProgressIterations: 0, shortIterations: 3, repeatedErrors: {}, lastPromiseTag: null };
    const warnings = detectStruggle(m);
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/short/i)])
    );
  });

  test('warns on repeated error >= 2', () => {
    const m: StruggleMetrics = { noProgressIterations: 0, shortIterations: 0, repeatedErrors: { 'Error: fail': 2 }, lastPromiseTag: null };
    const warnings = detectStruggle(m);
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/fail/i)])
    );
  });

  test('returns empty when no struggle', () => {
    const m = freshStruggleMetrics();
    expect(detectStruggle(m)).toEqual([]);
  });
});



describe('createPlan with attempts/struggle', () => {
  test('stores optional attempts and struggle', () => {
    const tmp = createTempProject();
    const active = createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      attempts: 3,
      struggle: { noProgressIterations: 2, shortIterations: 1, repeatedErrors: { 'Error: x': 1 }, lastPromiseTag: null },
      projectRoot: tmp,
    });
    const index = readPlanIndex(tmp)!;
    const entry = index.plans.find(p => p.id === active.entry.id)!;
    expect(entry.attempts).toBe(3);
    expect(entry.struggle?.noProgressIterations).toBe(2);
    expect(entry.struggle?.shortIterations).toBe(1);
    expect(entry.struggle?.repeatedErrors['Error: x']).toBe(1);
  });

  test('omits attempts/struggle when not provided', () => {
    const tmp = createTempProject();
    createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      projectRoot: tmp,
    });
    const index = readPlanIndex(tmp)!;
    const entry = index.plans.find(p => p.id === 'plan-001')!;
    expect(entry.attempts).toBeUndefined();
    expect(entry.struggle).toBeUndefined();
  });
});

describe('createPlanIteration with attempts/struggle', () => {
  test('carries forward parent attempts and struggle', () => {
    const tmp = createTempProject();
    const parent = createPlan({
      summary: 'Parent',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      attempts: 2,
      struggle: { noProgressIterations: 1, shortIterations: 0, repeatedErrors: {}, lastPromiseTag: null },
      projectRoot: tmp,
    });
    const iteration = createPlanIteration({
      parent: parent.entry.id,
      summary: 'Child',
      goal: 'Goal',
      check: 'check',
      tasksMarkdown: '- [x] Task 1',
      status: 'in_progress',
      completed: 0,
      blocked: 0,
      projectRoot: tmp,
    });
    const index = readPlanIndex(tmp)!;
    const childEntry = index.plans.find(p => p.id === iteration.entry.id)!;
    expect(childEntry.attempts).toBe(2);
    expect(childEntry.struggle?.noProgressIterations).toBe(1);
  });

  test('overrides with explicit values', () => {
    const tmp = createTempProject();
    const parent = createPlan({
      summary: 'Parent',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      attempts: 2,
      struggle: { noProgressIterations: 1, shortIterations: 0, repeatedErrors: {}, lastPromiseTag: null },
      projectRoot: tmp,
    });
    const iteration = createPlanIteration({
      parent: parent.entry.id,
      summary: 'Child',
      goal: 'Goal',
      check: 'check',
      tasksMarkdown: '- [x] Task 1',
      status: 'in_progress',
      completed: 0,
      blocked: 0,
      attempts: 5,
      struggle: { noProgressIterations: 3, shortIterations: 2, repeatedErrors: {}, lastPromiseTag: null },
      projectRoot: tmp,
    });
    const index = readPlanIndex(tmp)!;
    const childEntry = index.plans.find(p => p.id === iteration.entry.id)!;
    expect(childEntry.attempts).toBe(5);
    expect(childEntry.struggle?.noProgressIterations).toBe(3);
  });
});

describe('updatePlanStatus with attempts/struggle', () => {
  test('patches attempts and struggle without clearing other fields', () => {
    const tmp = createTempProject();
    const active = createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1', 'Task 2'],
      status: 'in_progress',
      projectRoot: tmp,
    });

    updatePlanStatus({
      id: active.entry.id,
      status: 'in_progress',
      completed: 1,
      attempts: 3,
      struggle: { noProgressIterations: 1, shortIterations: 0, repeatedErrors: {}, lastPromiseTag: null },
      projectRoot: tmp,
    });

    const index = readPlanIndex(tmp)!;
    const entry = index.plans.find(p => p.id === active.entry.id)!;
    expect(entry.completed).toBe(1);
    expect(entry.attempts).toBe(3);
    expect(entry.struggle?.noProgressIterations).toBe(1);
  });

  test('updatePlanStatus does not affect attempts/struggle when not provided', () => {
    const tmp = createTempProject();
    const active = createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      attempts: 2,
      struggle: { noProgressIterations: 1, shortIterations: 0, repeatedErrors: {}, lastPromiseTag: null },
      projectRoot: tmp,
    });

    updatePlanStatus({
      id: active.entry.id,
      status: 'done',
      completed: 1,
      projectRoot: tmp,
    });

    const index = readPlanIndex(tmp)!;
    const entry = index.plans.find(p => p.id === active.entry.id)!;
    expect(entry.attempts).toBe(2);
    expect(entry.struggle?.noProgressIterations).toBe(1);
  });
});
});

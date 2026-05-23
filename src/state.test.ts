import { describe, expect, test, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { createTempProject, writeIndex, readIndex, cleanupTempDirs } from './test-utils';

import {
  findProjectRoot,
  resetProjectRootCache,
  cacheDir,
  readPlanIndex,
  writePlanIndex,
  pruneExpiredPlans,
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
  createAutoPlan,
  generatePlanTemplate,
  assessPlanQuality,
  validatePlanTransition,
  transitionPlanStatus,
  generateRetrospective,
} from './state.js';
import type { PlanIndex, PlanIndexEntry, ActivePlan, StruggleMetrics, RetentionPolicy, PlanQualityReport } from './state.js';
import { getPlanState, getPlanGate, getCurrentState, getPlanGateFromState } from './runtime.js';
import type { AgnesRuntimeState } from './runtime.js';

afterAll(() => {
  cleanupTempDirs();
});

describe('findProjectRoot', () => {
  test('reset helper clears cached no-arg root', () => {
    resetProjectRootCache();
    expect(true).toBe(true);
  });

  test('returns null when no .agnes/index.json exists', () => {
    resetProjectRootCache();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    expect(findProjectRoot(tmp)).toBeNull();
  });

  test('finds project root when .agnes/index.json exists', () => {
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

      fs.mkdirSync(path.join(tmp, '.agnes'), { recursive: true });
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
      fs.rmSync(path.join(tmp, '.agnes'), { recursive: true, force: true });
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
expect(cacheDir(tmp)).toBe(path.join(tmp, '.agnes'));
  });
  
  test('returns path for existing temporary root even without index', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    expect(cacheDir(tmp)).toBe(path.join(tmp, '.agnes'));
  });
});

describe('readPlanIndex / writePlanIndex', () => {
  test('readPlanIndex returns null for missing index', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
    expect(readPlanIndex(tmp)).toBeNull();
  });

  test('readPlanIndex returns null for corrupt index', () => {
    const tmp = createTempProject();
    fs.writeFileSync(path.join(tmp, '.agnes', 'index.json'), 'not json', 'utf8');
    expect(readPlanIndex(tmp)).toBeNull();
  });

  test('readPlanIndex returns null for invalid schema shape', () => {
    const tmp = createTempProject();
    fs.writeFileSync(
      path.join(tmp, '.agnes', 'index.json'),
      JSON.stringify({ schemaVersion: 2, projectDir: tmp, activePlanId: null, plans: 'bad' }),
      'utf8',
    );
    expect(readPlanIndex(tmp)).toBeNull();
  });

  test('readPlanIndex returns null for entry missing required fields', () => {
    const tmp = createTempProject();
    fs.writeFileSync(
      path.join(tmp, '.agnes', 'index.json'),
      JSON.stringify({
        agnesVersion: '0.7.0',
        schemaVersion: 2,
        projectDir: tmp,
        projectName: 'test',
        updatedAt: new Date().toISOString(),
        activePlanId: null,
        plans: [
          { id: 'plan-001', status: 'draft', summary: 'test', total: 0, completed: 0, blocked: 0 },
        ],
      }),
      'utf8',
    );
    expect(readPlanIndex(tmp)).toBeNull();
  });

  test('readPlanIndex auto-migrates entry missing file', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    fs.writeFileSync(
      path.join(tmp, '.agnes', 'index.json'),
      JSON.stringify({
        agnesVersion: '0.7.0',
        schemaVersion: 2,
        projectDir: tmp,
        projectName: 'test',
        updatedAt: now,
        activePlanId: 'plan-001',
        plans: [
          {
            id: 'plan-001',
            status: 'in_progress',
            createdAt: now,
            updatedAt: now,
            summary: 'old plan',
            total: 3,
            completed: 1,
            blocked: 0,
            file: 'plan-001.yaml',
          },
          {
            id: 'plan-002',
            status: 'draft',
            createdAt: now,
            updatedAt: now,
            summary: 'migrated',
            total: 0,
            completed: 0,
            blocked: 0,
          },
        ],
      }),
      'utf8',
    );
    const index = readPlanIndex(tmp);
    expect(index).not.toBeNull();
    const migrated = index!.plans.find(p => p.id === 'plan-002')!;
    expect(migrated.file).toBe('plan-002.yaml');
    expect(migrated.attempts).toBe(0);
    expect(migrated.struggle).toEqual({
      noProgressIterations: 0,
      shortIterations: 0,
      repeatedErrors: {},
      lastPromiseTag: null,
    });
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
        file: 'plan-001.yaml',
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
      file: 'plan-001.yaml',
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
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), `schema: agnes/plan-v1
id: plan-001
version: 1
createdAt: ${now}
updatedAt: ${now}
status: in_progress
parent: null
goal: Active plan
check: Validate the active plan
summary: Active plan
tasks:
  - id: task-001
    summary: Do the thing
    status: pending
    files:
      - Verify the thing works
    depends_on: []
notes: []
`, 'utf8');
    const active = getLatestActivePlan(tmp);
    expect(active).not.toBeNull();
    expect(active!.entry.id).toBe('plan-001');
    expect(active!.content).toContain('goal: Active plan');
  });

  test('handles NaN updatedAt gracefully in fallback sort', () => {
    const tmp = createTempProject();
    const now = new Date().toISOString();
    writeIndex(tmp, {
      agnesVersion: '0.7.1',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: now,
      activePlanId: null,
      plans: [
        {
          id: 'plan-001',
          status: 'in_progress' as const,
          createdAt: now,
          updatedAt: 'not-a-date',
          summary: 'Bad date plan',
          total: 1,
          completed: 0,
          blocked: 0,
          file: 'plan-001.yaml',
        },
        {
          id: 'plan-002',
          status: 'in_progress' as const,
          createdAt: now,
          updatedAt: now,
          summary: 'Good date plan',
          total: 1,
          completed: 0,
          blocked: 0,
          file: 'plan-002.yaml',
        },
      ],
    });
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), `schema: agnes/plan-v1
id: plan-001
version: 1
createdAt: ${now}
updatedAt: ${now}
status: in_progress
parent: null
goal: Bad date
check: Validate bad date plan
summary: Bad date plan
tasks:
  - id: task-001
    summary: Bad task
    status: pending
    files:
      - Bad verification
    depends_on: []
notes: []
`, 'utf8');
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-002.yaml'), `schema: agnes/plan-v1
id: plan-002
version: 1
createdAt: ${now}
updatedAt: ${now}
status: in_progress
parent: null
goal: Good date
check: Validate good date plan
summary: Good date plan
tasks:
  - id: task-001
    summary: Good task
    status: pending
    files:
      - Good verification
    depends_on: []
notes: []
`, 'utf8');
    // Should not throw and should return the valid-date plan
    const active = getLatestActivePlan(tmp);
    expect(active).not.toBeNull();
    expect(active!.entry.id).toBe('plan-002');
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
        file: 'plan-001.yaml',
      }],
    });
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), `schema: agnes/plan-v1
id: plan-001
version: 1
createdAt: ${now}
updatedAt: ${now}
status: in_progress
parent: null
goal: Test the system
check: Verify the system works
summary: Active plan
tasks:
  - id: task-001
    summary: one
    status: done
    files:
      - verify one
    depends_on: []
  - id: task-002
    summary: two
    status: pending
    files:
      - verify two
    depends_on: []
  - id: task-003
    summary: three
    status: pending
    files:
      - verify three
    depends_on: []
notes: []
`, 'utf8');
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
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), '', 'utf8');
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-003.yaml'), '', 'utf8');
    expect(getNextPlanId(tmp)).toBe('plan-004');
  });

  test('ignores non-plan files', () => {
    const tmp = createTempProject();
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), '', 'utf8');
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), '', 'utf8');
    fs.writeFileSync(path.join(tmp, '.agnes', 'index.json'), '{}', 'utf8');
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
    const planPath = path.join(tmp, '.agnes', 'plans', 'plan-001.yaml');
    expect(fs.existsSync(planPath)).toBe(true);
    const tmpFiles = fs.readdirSync(path.join(tmp, '.agnes', 'plans'))
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

    const planPath = path.join(tmp, '.agnes', 'plans', 'plan-001.yaml');
    expect(fs.existsSync(planPath)).toBe(true);
    const content = fs.readFileSync(planPath, 'utf8');
    expect(content).toContain('goal: Complete the test');
    expect(content).toContain('check: bun test passes');
    expect(content).toContain('summary: Write tests');
    expect(content).toContain('summary: Refactor code');
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
    const content = fs.readFileSync(path.join(tmp, '.agnes', 'plans', `${active.entry.id}.yaml`), 'utf8');
    expect(content).toContain('status: done');
    expect(content).toContain('summary: Completed');
    expect(content).toContain('summary: Blocked');
    expect(content).toContain('summary: Pending');
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
  test('plan yaml file has no runtime state fields (createPlan)', () => {
    const tmp = createTempProject();
    createPlan({
      summary: 'Test',
      goal: 'Goal',
      check: 'check',
      tasks: ['Task 1'],
      status: 'in_progress',
      projectRoot: tmp,
    });
    const content = fs.readFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'utf8');
    expect(content).toContain('schema: agnes/plan-v1');
    expect(content).not.toMatch(/^total:/m);
    expect(content).not.toMatch(/^completed:/m);
    expect(content).not.toMatch(/^blocked:/m);
    expect(content).toContain('id: plan-001');
    expect(content).toContain('createdAt:');
  });

  test('plan yaml file has no runtime state fields (createPlanIteration)', () => {
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
    const content = fs.readFileSync(path.join(tmp, '.agnes', 'plans', 'plan-002.yaml'), 'utf8');
    expect(content).toContain('status: in_progress');
    expect(content).toContain('parent: plan-001');
    expect(content).not.toMatch(/^total:/m);
    expect(content).not.toMatch(/^completed:/m);
    expect(content).not.toMatch(/^blocked:/m);
  });

  test('plan file contains structured yaml content', () => {
    const tmp = createTempProject();
    createPlan({
      summary: 'Test',
      goal: 'Build the feature',
      check: 'bun test',
      tasks: ['Task 1', 'Task 2'],
      projectRoot: tmp,
    });
    const content = fs.readFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'utf8');
    expect(content).toContain('goal: Build the feature');
    expect(content).toContain('check: bun test');
    expect(content).toContain('summary: Task 1');
    expect(content).toContain('summary: Task 2');
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
        file: 'plan-001.yaml',
      }],
    });
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'schema: agnes/plan-v1\nid: plan-001\nversion: 1\ncreatedAt: 2026-01-01T00:00:00.000Z\nupdatedAt: 2026-01-01T00:00:00.000Z\nstatus: in_progress\nparent: null\ngoal: Test\ncheck: Verify\nsummary: Active plan\ntasks:\n  - id: task-001\n    summary: one\n    status: done\n    files:\n      - verify one\n    depends_on: []\n  - id: task-002\n    summary: two\n    status: pending\n    files:\n      - verify two\n    depends_on: []\nnotes: []\n', 'utf8');
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
        file: 'plan-001.yaml',
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
        file: 'plan-001.yaml',
      }],
    });
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'schema: agnes/plan-v1\nid: plan-001\nversion: 1\ncreatedAt: 2026-01-01T00:00:00.000Z\nupdatedAt: 2026-01-01T00:00:00.000Z\nstatus: in_progress\nparent: null\ngoal: Test\ncheck: Verify\nsummary: Active plan\ntasks:\n  - id: task-001\n    summary: one\n    status: pending\n    files:\n      - verify one\n    depends_on: []\nnotes: []\n', 'utf8');
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
        file: 'plan-001.yaml',
      }],
    });
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'schema: agnes/plan-v1\nid: plan-001\nversion: 1\ncreatedAt: 2026-01-01T00:00:00.000Z\nupdatedAt: 2026-01-01T00:00:00.000Z\nstatus: blocked\nparent: null\ngoal: Test\ncheck: Verify\nsummary: Blocked plan\ntasks:\n  - id: task-001\n    summary: one\n    status: pending\n    files:\n      - verify one\n    depends_on: []\nnotes: []\n', 'utf8');
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

  test('rejects wrong expected tag in legacy tag format', () => {
    expect(detectPromiseTag('<promise>DONE</promise>', 'FAIL')).toBe(false);
  });

  test('rejects wrong expected status via JSON completion message', () => {
    const json = JSON.stringify({ type: 'completion', status: 'DONE', id: '1', timestamp: new Date().toISOString(), summary: 'done' });
    expect(detectPromiseTag(json, 'FAIL')).toBe(false);
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
    expect(extractPromiseTag('<promise>DONE</promise> more <promise>BLOCKED</promise>')).toBe('DONE');
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

  test('migrates missing attempts/struggle on read', () => {
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
    expect(entry.attempts).toBe(0);
    expect(entry.struggle).toEqual({
      noProgressIterations: 0,
      shortIterations: 0,
      repeatedErrors: {},
      lastPromiseTag: null,
    });
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
}); // closes describe('updatePlanStatus with attempts/struggle', ...)

describe('pruneExpiredPlans', () => {
  const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const freshDate = new Date().toISOString();

  function makeEntry(id: string, status: 'done' | 'abandoned' | 'in_progress', updatedAt: string, file?: string): PlanIndexEntry {
    return {
      id,
      status,
      createdAt: updatedAt,
      updatedAt,
      summary: `${id} summary`,
      total: 1,
      completed: status === 'done' ? 1 : 0,
      blocked: 0,
      file: file ?? `${id}.yaml`,
    };
  }

  test('removes done plans older than 7 days', () => {
    const tmp = createTempProject();
    const index: PlanIndex = {
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: freshDate,
      activePlanId: null,
      plans: [makeEntry('plan-001', 'done', oldDate, 'plan-001.yaml')],
    };
    writeIndex(tmp, index);
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'old plan', 'utf8');

    const result = pruneExpiredPlans(readIndex(tmp)!, tmp);
    expect(result.plans.length).toBe(0);
    expect(fs.existsSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'))).toBe(false);
  });

  test('removes abandoned plans older than 7 days', () => {
    const tmp = createTempProject();
    const index: PlanIndex = {
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: freshDate,
      activePlanId: null,
      plans: [makeEntry('plan-001', 'abandoned', oldDate, 'plan-001.yaml')],
    };
    writeIndex(tmp, index);
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'old plan', 'utf8');

    const result = pruneExpiredPlans(readIndex(tmp)!, tmp);
    expect(result.plans.length).toBe(0);
    expect(fs.existsSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'))).toBe(false);
  });

  test('keeps non-terminal plans regardless of age', () => {
    const tmp = createTempProject();
    const index: PlanIndex = {
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: freshDate,
      activePlanId: null,
      plans: [makeEntry('plan-001', 'in_progress', oldDate, 'plan-001.yaml')],
    };
    writeIndex(tmp, index);
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'still active', 'utf8');

    const result = pruneExpiredPlans(readIndex(tmp)!, tmp);
    expect(result.plans.length).toBe(1);
    expect(fs.existsSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'))).toBe(true);
  });

  test('keeps done plans newer than 7 days', () => {
    const tmp = createTempProject();
    const index: PlanIndex = {
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: freshDate,
      activePlanId: null,
      plans: [makeEntry('plan-001', 'done', freshDate, 'plan-001.yaml')],
    };
    writeIndex(tmp, index);
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'recent plan', 'utf8');

    const result = pruneExpiredPlans(readIndex(tmp)!, tmp);
    expect(result.plans.length).toBe(1);
    expect(fs.existsSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'))).toBe(true);
  });

  test('clears activePlanId when pruned plan was active', () => {
    const tmp = createTempProject();
    const index: PlanIndex = {
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: freshDate,
      activePlanId: 'plan-001',
      plans: [makeEntry('plan-001', 'done', oldDate, 'plan-001.yaml')],
    };
    writeIndex(tmp, index);
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'was active', 'utf8');

    const result = pruneExpiredPlans(readIndex(tmp)!, tmp);
    expect(result.activePlanId).toBeNull();
    expect(result.plans.length).toBe(0);
  });

  test('uses custom retention policy when provided', () => {
    const tmp = createTempProject();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const index: PlanIndex = {
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: freshDate,
      activePlanId: null,
      plans: [makeEntry('plan-001', 'done', twoDaysAgo, 'plan-001.yaml')],
      retention: { maxAgeDays: 1, terminalStatuses: ['done'] },
    };
    writeIndex(tmp, index);
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), '2 days old, 1 day retention', 'utf8');

    const result = pruneExpiredPlans(readIndex(tmp)!, tmp);
    expect(result.plans.length).toBe(0);
    expect(fs.existsSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'))).toBe(false);
  });

  test('does nothing on empty plan list', () => {
    const tmp = createTempProject();
    const index: PlanIndex = {
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: freshDate,
      activePlanId: null,
      plans: [],
    };
    writeIndex(tmp, index);
    const result = pruneExpiredPlans(readIndex(tmp)!, tmp);
    expect(result.plans.length).toBe(0);
  });

  test('handles NaN updatedAt gracefully (skips, does not crash)', () => {
    const tmp = createTempProject();
    const index: PlanIndex = {
      agnesVersion: '0.7.2',
      schemaVersion: 2,
      projectDir: tmp,
      projectName: 'test',
      updatedAt: freshDate,
      activePlanId: null,
      plans: [{
        id: 'plan-001',
        status: 'done',
        createdAt: freshDate,
        updatedAt: 'not-a-date',
        summary: 'broken date plan',
        total: 1,
        completed: 1,
        blocked: 0,
        file: 'plan-001.yaml',
      }],
    };
    writeIndex(tmp, index);
    fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'bad date', 'utf8');

    const result = pruneExpiredPlans(readIndex(tmp)!, tmp);
    expect(result.plans.length).toBe(1);
    expect(fs.existsSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'))).toBe(true);
  });
});

describe('planning discipline', () => {
  const minValidPlan = `schema: agnes/plan-v1
id: plan-001
version: 1
createdAt: 2026-01-01T00:00:00.000Z
updatedAt: 2026-01-01T00:00:00.000Z
status: draft
parent: null
goal: Build a login system with OAuth and proper validation
check: All tests pass, login flow verified, security review completed
summary: Test goal
tasks:
  - id: task-001
    summary: Add OAuth provider
    status: pending
    files:
      - Integration test passes
    depends_on: []
  - id: task-002
    summary: Add session handling
    status: pending
    files:
      - Unit test coverage > 80%
    depends_on:
      - task-001
  - id: task-003
    summary: Add login UI
    status: pending
    files:
      - E2E login flow works
    depends_on:
      - task-001
notes:
  - OAuth tokens may expire. Monitor token refresh errors.
`;

  describe('generatePlanTemplate', () => {
    test('produces valid markdown with all required sections', () => {
      const result = generatePlanTemplate('plan-001', 'Test goal');
      expect(result).toContain('# plan-001');
      expect(result).toContain('## Intent');
      expect(result).toContain('## Goal');
      expect(result).toContain('## Tasks');
      expect(result).toContain('## Risks');
      expect(result).toContain('## Completion Criteria');
      expect(result).toContain('## Validation');
    });

    test('truncates long goal in heading', () => {
      const longGoal = 'a'.repeat(100);
      const result = generatePlanTemplate('plan-001', longGoal);
      expect(result).toContain('# plan-001 —');
      expect(result).toContain(longGoal);
    });
  });

  describe('assessPlanQuality', () => {
    test('scores a minimal plan low', () => {
      const minimal = `# plan-001 — Test

## Intent


## Goal
fix things

## Tasks
| # | Task | Dependencies | Effort | Verification |
|---|------|-------------|--------|-------------|

## Risks
<!-- What could go wrong, how to detect it early -->

## Completion Criteria
<!-- Verifiable conditions -->

## Validation
<!-- How to confirm the plan was correct after execution -->
`;
      const report = assessPlanQuality(minimal);
      expect(report.score).toBeLessThan(60);
      expect(report.flags.length).toBeGreaterThan(0);
    });

    test('scores a complete plan high', () => {
      const report = assessPlanQuality(minValidPlan);
      expect(report.score).toBeGreaterThanOrEqual(60);
    });

    test('flags missing tasks', () => {
      const noTasks = `# plan-001 — Test

## Intent


## Goal
Build a login system

## Tasks
| # | Task | Dependencies | Effort | Verification |
|---|------|-------------|--------|-------------|

## Risks
Some risks

## Completion Criteria
All tests pass and verified

## Validation

`;
      const report = assessPlanQuality(noTasks);
      expect(report.flags).toContain('no_tasks');
    });

    test('flags missing verification', () => {
      const noVerification = `# plan-001 — Test

## Intent


## Goal
Build a login system with OAuth validation

## Tasks
| # | Task | Dependencies | Effort | Verification |
|---|------|-------------|--------|-------------|
| 1 | Add OAuth provider |  | M |  |
| 2 | Add session handling | 1 | L | Unit test passes |

## Risks
Some risks

## Completion Criteria
All tests pass and verified

## Validation

`;
      const report = assessPlanQuality(noVerification);
      expect(report.flags).toContain('task_1_missing_verification');
    });

    test('flags goal with filler', () => {
      const fillerGoal = `# plan-001 — Test

## Intent


## Goal
fix things

## Tasks
| # | Task | Dependencies | Effort | Verification |
|---|------|-------------|--------|-------------|
| 1 | Do something |  | M | Check |

## Risks
Some risks

## Completion Criteria
All tests pass and verified

## Validation

`;
      const report = assessPlanQuality(fillerGoal);
      expect(report.flags).toContain('goal_has_filler');
    });

    test('flags dependency cycles', () => {
      const cyclicPlan = `# plan-001 — Test

## Intent


## Goal
Build a login system with proper validation

## Tasks
| # | Task | Dependencies | Effort | Verification |
|---|------|-------------|--------|-------------|
| 1 | Task one | 2 | M | Test passes |
| 2 | Task two | 1 | L | Test passes |

## Risks
Some risks

## Completion Criteria
All tests pass and verified

## Validation

`;
      const report = assessPlanQuality(cyclicPlan);
      expect(report.flags).toContain('dependency_cycle');
    });

    test('flags weak completion criteria', () => {
      const weakCriteria = `# plan-001 — Test

## Intent


## Goal
Build a login system with proper validation

## Tasks
| # | Task | Dependencies | Effort | Verification |
|---|------|-------------|--------|-------------|
| 1 | Add OAuth |  | M | Test passes |

## Risks
Some risks

## Completion Criteria
fix things

## Validation

`;
      const report = assessPlanQuality(weakCriteria);
      expect(report.flags).toContain('weak_completion_criteria');
    });
  });

  describe('validatePlanTransition', () => {
    test('allows valid transitions', () => {
      expect(validatePlanTransition('draft', 'reviewed')).toBe(true);
      expect(validatePlanTransition('reviewed', 'ready')).toBe(true);
      expect(validatePlanTransition('ready', 'in_progress')).toBe(true);
      expect(validatePlanTransition('in_progress', 'done')).toBe(true);
      expect(validatePlanTransition('in_progress', 'blocked')).toBe(true);
      expect(validatePlanTransition('blocked', 'ready')).toBe(true);
      expect(validatePlanTransition('draft', 'abandoned')).toBe(true);
      expect(validatePlanTransition('reviewed', 'draft')).toBe(true);
    });

    test('rejects invalid transitions', () => {
      expect(validatePlanTransition('draft', 'done')).toBe(false);
      expect(validatePlanTransition('draft', 'in_progress')).toBe(false);
      expect(validatePlanTransition('done', 'in_progress')).toBe(false);
      expect(validatePlanTransition('abandoned', 'draft')).toBe(false);
      expect(validatePlanTransition('reviewed', 'in_progress')).toBe(false);
    });

    test('rejects transition for unknown current status', () => {
      expect(validatePlanTransition('unknown', 'done')).toBe(false);
    });
  });

  describe('createAutoPlan', () => {
    test('creates entry with correct id and initial draft status', () => {
      const tmp = createTempProject();
      const id = createAutoPlan({ goal: 'Test the system', source: 'user' }, tmp);
      expect(id).toBe('plan-001');

      const index = readPlanIndex(tmp)!;
      const entry = index.plans.find(p => p.id === id)!;
      expect(entry).toBeDefined();
      expect(entry.status).toBe('draft');
      expect(entry.summary).toBe('Test the system');
      expect(entry.total).toBe(0);
      expect(fs.existsSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'))).toBe(true);
    });

    test('creates entry with ready status for user_ready source', () => {
      const tmp = createTempProject();
      const id = createAutoPlan({ goal: 'Ready to go', source: 'user_ready' }, tmp);
      const index = readPlanIndex(tmp)!;
      const entry = index.plans.find(p => p.id === id)!;
      expect(entry.status).toBe('ready');
    });

    test('creates entry with draft status for gate source', () => {
      const tmp = createTempProject();
      const id = createAutoPlan({ goal: 'Gate triggered', source: 'gate' }, tmp);
      const index = readPlanIndex(tmp)!;
      const entry = index.plans.find(p => p.id === id)!;
      expect(entry.status).toBe('draft');
    });

    test('increments plan id correctly', () => {
      const tmp = createTempProject();
      const id1 = createAutoPlan({ goal: 'First', source: 'user' }, tmp);
      const id2 = createAutoPlan({ goal: 'Second', source: 'user' }, tmp);
      expect(id1).toBe('plan-001');
      expect(id2).toBe('plan-002');
    });
  });

  describe('transitionPlanStatus', () => {
    test('transitions draft→reviewed→ready→in_progress→done', () => {
      const tmp = createTempProject();
      const id = createAutoPlan({ goal: 'Build the feature with full test coverage', source: 'user' }, tmp);
      const planPath = path.join(tmp, '.agnes', 'plans', `${id}.yaml`);
      fs.writeFileSync(planPath, minValidPlan, 'utf8');

      let index = transitionPlanStatus(id, 'reviewed', tmp);
      expect(index).not.toBeNull();
      expect(index!.plans.find(p => p.id === id)!.status).toBe('reviewed');

      index = transitionPlanStatus(id, 'ready', tmp);
      expect(index!.plans.find(p => p.id === id)!.status).toBe('ready');

      index = transitionPlanStatus(id, 'in_progress', tmp);
      expect(index!.plans.find(p => p.id === id)!.status).toBe('in_progress');
      expect(index!.activePlanId).toBe(id);

      index = transitionPlanStatus(id, 'done', tmp);
      expect(index!.plans.find(p => p.id === id)!.status).toBe('done');
      expect(index!.activePlanId).toBeNull();
    });

    test('blocks invalid transition', () => {
      const tmp = createTempProject();
      const id = createAutoPlan({ goal: 'Test', source: 'user' }, tmp);
      const result = transitionPlanStatus(id, 'done', tmp);
      expect(result).toBeNull();

      const index = readPlanIndex(tmp)!;
      expect(index.plans.find(p => p.id === id)!.status).toBe('draft');
    });

    test('blocks draft→reviewed when quality insufficient', () => {
      const tmp = createTempProject();
      const id = createAutoPlan({ goal: 'fix things', source: 'user' }, tmp);
      const planPath = path.join(tmp, '.agnes', 'plans', `${id}.yaml`);
      const badPlan = `schema: agnes/plan-v1
id: ${id}
version: 1
createdAt: 2026-01-01T00:00:00.000Z
updatedAt: 2026-01-01T00:00:00.000Z
status: draft
parent: null
goal: fix things
check: TBD
summary: Test
tasks: []
notes: []
`;
      fs.writeFileSync(planPath, badPlan, 'utf8');

      const result = transitionPlanStatus(id, 'reviewed', tmp);
      expect(result).toBeNull();

      const index = readPlanIndex(tmp)!;
      expect(index.plans.find(p => p.id === id)!.status).toBe('draft');
    });

    test('returns null for nonexistent plan', () => {
      const tmp = createTempProject();
      const result = transitionPlanStatus('plan-999', 'done', tmp);
      expect(result).toBeNull();
    });
  });

  describe('generateRetrospective', () => {
    test('produces correct stats for completed plan', () => {
      const tmp = createTempProject();
      const now = new Date().toISOString();
      const index: PlanIndex = {
        agnesVersion: '0.7.2',
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
          summary: 'Completed plan',
          total: 4,
          completed: 3,
          blocked: 1,
          file: 'plan-001.yaml',
        }],
      };
      writeIndex(tmp, index);
      fs.writeFileSync(path.join(tmp, '.agnes', 'plans', 'plan-001.yaml'), 'schema: agnes/plan-v1\nid: plan-001\nversion: 1\ncreatedAt: 2026-01-01T00:00:00.000Z\nupdatedAt: 2026-01-01T00:00:00.000Z\nstatus: done\nparent: null\ngoal: Completed\ncheck: Verify\nsummary: Completed plan\ntasks: []\nnotes: []\n', 'utf8');

      const retro = generateRetrospective('plan-001', tmp);
      expect(retro).toContain('plan-001');
      expect(retro).toContain('done');
      expect(retro).toContain('3/4');
      expect(retro).toContain('1');
      expect(retro).toContain('75%');
    });
  });

  describe('integration: full planning discipline flow', () => {
    test('createAutoPlan → assessPlanQuality → transitionPlanStatus full flow', () => {
      const tmp = createTempProject();
      const id = createAutoPlan({ goal: 'Implement user authentication with OAuth', source: 'user' }, tmp);
      expect(id).toBe('plan-001');

      const planPath = path.join(tmp, '.agnes', 'plans', 'plan-001.yaml');
      fs.writeFileSync(planPath, minValidPlan, 'utf8');

      const initialIndex = readPlanIndex(tmp)!;
      expect(initialIndex.plans[0].status).toBe('draft');

      const quality = assessPlanQuality(minValidPlan);
      expect(quality.score).toBeGreaterThanOrEqual(60);

      const reviewed = transitionPlanStatus(id, 'reviewed', tmp);
      expect(reviewed!.plans.find(p => p.id === id)!.status).toBe('reviewed');

      const ready = transitionPlanStatus(id, 'ready', tmp);
      expect(ready!.plans.find(p => p.id === id)!.status).toBe('ready');

      const inProgress = transitionPlanStatus(id, 'in_progress', tmp);
      expect(inProgress!.activePlanId).toBe(id);

      const retro = generateRetrospective(id, tmp);
      expect(retro).toContain('plan-001');

      const done = transitionPlanStatus(id, 'done', tmp);
      expect(done!.activePlanId).toBeNull();

      const planContent = fs.readFileSync(planPath, 'utf8');
      expect(planContent).toContain('schema: agnes/plan-v1');
    });
  });
});

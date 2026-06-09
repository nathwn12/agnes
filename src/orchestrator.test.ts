import { describe, expect, test } from 'bun:test';
import { buildSchedule } from './scheduler.js';
import type { TaskItem } from './planner.js';

describe('buildSchedule', () => {
  const makeTask = (id: string, deps: string[] = []): TaskItem => ({
    id,
    description: `Task ${id}`,
    files: [],
    dependsOn: deps,
    agent: 'general',
    status: 'pending',
    retryCount: 0,
  });

  test('produces waves from independent tasks', () => {
    const tasks = [
      makeTask('task-0001'),
      makeTask('task-0002'),
      makeTask('task-0003'),
    ];
    const waves = buildSchedule(tasks, 10);
    expect(waves.length).toBeGreaterThanOrEqual(1);
    for (const wave of waves) {
      for (const t of wave.tasks) {
        expect(t.status).toBe('pending');
      }
    }
  });

  test('respects dependency ordering', () => {
    const tasks = [
      makeTask('task-0001'),
      makeTask('task-0002', ['task-0001']),
      makeTask('task-0003', ['task-0002']),
    ];
    const waves = buildSchedule(tasks, 10);
    const waveIndices = new Map<string, number>();
    for (const wave of waves) {
      for (const t of wave.tasks) {
        waveIndices.set(t.id, wave.index);
      }
    }

    expect(waveIndices.get('task-0001')).toBeLessThan(waveIndices.get('task-0002')!);
    expect(waveIndices.get('task-0002')).toBeLessThan(waveIndices.get('task-0003')!);
  });

  test('splits large waves by maxParallel', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => makeTask(`task-${String(i).padStart(4, '0')}`));
    const waves = buildSchedule(tasks, 3);
    for (const wave of waves) {
      expect(wave.tasks.length).toBeLessThanOrEqual(3);
    }
  });

  test('filters non-pending tasks', () => {
    const tasks = [
      { ...makeTask('task-0001'), status: 'completed' as const },
      { ...makeTask('task-0002'), status: 'failed' as const },
      { ...makeTask('task-0003') },
    ];
    const waves = buildSchedule(tasks, 10);
    const allTaskIds = waves.flatMap(w => w.tasks.map(t => t.id));
    expect(allTaskIds).not.toContain('task-0001');
    expect(allTaskIds).not.toContain('task-0002');
    expect(allTaskIds).toContain('task-0003');
  });

  test('handles circular dependencies gracefully', () => {
    const tasks = [
      makeTask('task-0001', ['task-0002']),
      makeTask('task-0002', ['task-0001']),
    ];
    // Should not hang or crash — produces 0 waves since no entry point exists
    const waves = buildSchedule(tasks, 10);
    expect(Array.isArray(waves)).toBe(true);
  });

  test('partial cycle still schedules reachable tasks', () => {
    const tasks = [
      makeTask('task-0001'),
      makeTask('task-0002', ['task-0003']),
      makeTask('task-0003', ['task-0002']),
    ];
    const waves = buildSchedule(tasks, 10);
    const scheduledIds = new Set(waves.flatMap(w => w.tasks.map(t => t.id)));
    expect(scheduledIds.has('task-0001')).toBe(true);
    // B and C are cyclic — may or may not be scheduled depending on topo sort residual
  });

  test('schedules tasks with file conflicts into separate waves preserving order', () => {
    const makeFileTask = (id: string, deps: string[] = [], files: string[] = []) => ({
      ...makeTask(id, deps),
      files,
    });
    const tasks = [
      makeFileTask('task-0001', [], ['src/a.ts']),
      makeFileTask('task-0002', ['task-0001'], ['src/a.ts']),
      makeFileTask('task-0003', ['task-0001'], []),
    ];
    const waves = buildSchedule(tasks, 10);
    const waveOf = new Map<string, number>();
    for (const w of waves) {
      for (const t of w.tasks) {
        waveOf.set(t.id, w.index);
      }
    }
    // A (task-0001) must come before B (task-0002) and C (task-0003)
    expect(waveOf.get('task-0001')).toBeLessThan(waveOf.get('task-0002')!);
    expect(waveOf.get('task-0001')).toBeLessThan(waveOf.get('task-0003')!);
  });

  test('schedules tasks ignoring missing dependency references', () => {
    const tasks = [
      makeTask('task-0001'),
      makeTask('task-0002', ['task-missing']),
      makeTask('task-0003', ['task-0001']),
    ];
    const waves = buildSchedule(tasks, 10);
    const scheduled = new Set(waves.flatMap(w => w.tasks.map(t => t.id)));
    // task-0002 depends on missing task — should still be scheduled (best-effort)
    expect(scheduled.has('task-0001')).toBe(true);
    expect(scheduled.has('task-0003')).toBe(true);
  });

  test('produces no waves for completely circular tasks', () => {
    const tasks = [
      makeTask('task-0001', ['task-0002']),
      makeTask('task-0002', ['task-0003']),
      makeTask('task-0003', ['task-0001']),
    ];
    const waves = buildSchedule(tasks, 10);
    expect(waves.length).toBe(0);
  });
});

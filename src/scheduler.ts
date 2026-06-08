import type { TaskItem } from './planner.js';

export interface Wave {
  index: number;
  tasks: TaskItem[];
}

export interface FileConflict {
  taskA: string;
  taskB: string;
  file: string;
}

export function topologicalWaveSort(tasks: TaskItem[]): Wave[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
    if (!adjacency.has(t.id)) adjacency.set(t.id, []);
  }

  for (const t of tasks) {
    for (const dep of t.dependsOn) {
      if (!taskMap.has(dep)) continue;
      adjacency.get(dep)?.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
    }
  }

  const waves: Wave[] = [];
  let index = 0;

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  while (queue.length > 0) {
    const currentWave = [...queue];
    queue.length = 0;

    for (const id of currentWave) {
      for (const neighbor of adjacency.get(id) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    waves.push({
      index,
      tasks: currentWave.map(id => taskMap.get(id)!).filter(Boolean),
    });
    index++;
  }

  return waves;
}

export function detectFileConflicts(tasks: TaskItem[]): FileConflict[] {
  const fileOwners = new Map<string, string[]>();

  for (const t of tasks) {
    for (const f of t.files) {
      if (!fileOwners.has(f)) fileOwners.set(f, []);
      fileOwners.get(f)!.push(t.id);
    }
  }

  const conflicts: FileConflict[] = [];
  for (const [file, owners] of fileOwners) {
    if (owners.length > 1) {
      for (let i = 0; i < owners.length; i++) {
        for (let j = i + 1; j < owners.length; j++) {
          conflicts.push({ taskA: owners[i], taskB: owners[j], file });
        }
      }
    }
  }
  return conflicts;
}

export function resolveConflicts(
  wave: Wave,
  _allTasks: TaskItem[],
  _maxParallel: number,
): { resolved: Wave[]; demoted: TaskItem[] } {
  const conflicts = detectFileConflicts(wave.tasks);
  if (conflicts.length === 0) {
    return { resolved: [wave], demoted: [] };
  }

  const conflicted = new Set<string>();
  for (const c of conflicts) {
    if (!conflicted.has(c.taskA)) {
      conflicted.add(c.taskB);
    }
  }

  const keep: TaskItem[] = [];
  const demoted: TaskItem[] = [];
  for (const t of wave.tasks) {
    if (conflicted.has(t.id)) {
      demoted.push(t);
    } else {
      keep.push(t);
    }
  }

  const resolved: Wave[] = [];
  if (keep.length > 0) {
    resolved.push({ index: wave.index, tasks: keep });
  }

  return { resolved, demoted };
}

export function buildSchedule(tasks: TaskItem[], maxParallel: number): Wave[] {
  const onlyPending = tasks.filter(t => t.status === 'pending' || t.status === 'needs_review');

  const waves = topologicalWaveSort(onlyPending);

  const resolvedWaves: Wave[] = [];
  const allDemoted: TaskItem[] = [];

  for (const wave of waves) {
    const { resolved, demoted } = resolveConflicts(wave, tasks, maxParallel);
    resolvedWaves.push(...resolved);
    allDemoted.push(...demoted);
  }

  if (allDemoted.length > 0) {
    let idx = resolvedWaves.length;
    for (const task of allDemoted) {
      resolvedWaves.push({ index: idx++, tasks: [task] });
    }
  }

  const capped: Wave[] = [];
  for (const wave of resolvedWaves) {
    for (let i = 0; i < wave.tasks.length; i += maxParallel) {
      capped.push({
        index: capped.length,
        tasks: wave.tasks.slice(i, i + maxParallel),
      });
    }
  }

  return capped;
}

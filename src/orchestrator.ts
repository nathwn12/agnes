import type { TaskPlan, TaskItem } from './planner.js';
import {
  createPlan,
  savePlan,
  updatePlan,
  loadPlan,
  getFailedTasks,
  generateTaskID,
} from './planner.js';
import { buildSchedule } from './scheduler.js';
import type { Wave } from './scheduler.js';
import { runReview } from './reviewer.js';
import type { ReviewVerdict } from './reviewer.js';
import { delegateBlocking, delegateAsync, recordTaskRef, getSubagentResult } from './delegate.js';
import { getMaxConcurrency, detectModelTier } from './runtime.js';
import { buildResultMessage, parseAgnesMessage } from './protocol.js';
import * as logger from './logger.js';

type MinimalClient = any;

function findTopLevelBracket(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (!inString) {
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

interface OrchestrationParams {
  goal: string;
  tasks?: TaskItemInput[];
  planID?: string;
  maxIterations?: number;
  sessionID: string;
  directory: string;
}

interface TaskItemInput {
  id: string;
  description: string;
  files: string[];
  dependsOn: string[];
  agent: 'explore' | 'general';
  acceptanceCriteria?: string;
}

interface OrchestrationResult {
  planID: string;
  goal: string;
  phase: string;
  iterations: number;
  maxIterations: number;
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  failedTasks: number;
  editedFiles: string[];
  currentWave: number;
  totalWaves: number;
  passed: boolean;
  pendingCalls: number;
  error?: string;
}

function buildTaskPrompt(task: TaskItem, plan: TaskPlan): string {
  const completionMarker = buildResultMessage(task.id, 'SUMMARY_REPLACE_ME');

  const acceptanceNote = task.acceptanceCriteria
    ? `\n\n## Acceptance criteria\n${task.acceptanceCriteria}\nVerify that your implementation meets these criteria before reporting DONE.`
    : '';

  return `You are implementing ONE task in a larger plan.

## Goal
${plan.goal}

## Your task
${task.description}

## Files to edit
${task.files.join(', ')}${acceptanceNote}

## Instructions
1. Implement exactly what's described above. No more, no less.
2. Write tests for your changes if applicable.
3. Run tests to verify they pass.
4. Report what you did and which files you created or modified.

## Completion protocol
When done, place this marker at the very end of your response:
${completionMarker}

Replace SUMMARY_REPLACE_ME with a brief summary of what you implemented.
Status DONE if everything works. Status BLOCKED if you cannot proceed.
`;
}

async function decomposeGoal(
  client: MinimalClient,
  goal: string,
  sessionID: string,
  directory: string,
): Promise<TaskItemInput[]> {
  const completionMarker = buildResultMessage('_decomposer', 'done');

  const prompt = `You are a task decomposer for a software engineering plan. Given a goal, break it into specific implementation tasks.

Goal: ${goal}

Return a JSON array of tasks. Each task object has these fields:
- "id": unique string like "task-0001"
- "description": clear description of ONE thing to implement (1-2 sentences)
- "files": array of file paths this task will affect (use realistic paths relative to project root)
- "dependsOn": array of task IDs this depends on (empty array if none)
- "agent": "general" for implementation tasks, "explore" for research/investigation tasks
- "acceptanceCriteria": (optional) specific conditions that must be true for this task to be done

Rules:
- Each task should be independently implementable by one subagent
- Maximum 20 tasks
- Order tasks by dependency (tasks with no deps first)
- A task that reads but doesn't write files can use agent "explore"
- Respond with ONLY the JSON array and the completion marker below, no other text

## Completion protocol
When done, place this marker at the very end of your response:
${completionMarker}`;

  const result = await delegateBlocking(client, {
    agent: 'general',
    description: `Decompose: ${goal.substring(0, 80)}`,
    prompt,
    sessionID,
    directory,
  });

  if (result.startsWith('ERROR:')) {
    throw new Error(`Goal decomposition failed: ${result}`);
  }

  const jsonStr = findTopLevelBracket(result, '[', ']');
  if (!jsonStr) {
    throw new Error('Decomposition returned no valid JSON — subagent did not respond with task list');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Decomposition returned invalid JSON');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Decomposition returned empty task list');
  }

  return parsed.map((t: Record<string, unknown>, i: number) => {
    const rawId = typeof t.id === 'string' && t.id ? t.id : generateTaskID();
    return {
      id: rawId,
      description: typeof t.description === 'string' && t.description ? t.description : `Task ${i + 1}`,
      files: Array.isArray(t.files) ? t.files as string[] : [],
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn as string[] : [],
      agent: (t.agent === 'explore' ? 'explore' : 'general') as 'explore' | 'general',
      acceptanceCriteria: typeof t.acceptanceCriteria === 'string' ? t.acceptanceCriteria : undefined,
    };
  });
}

function validateScheduleComplete(plan: TaskPlan): string[] {
  const scheduledIds = new Set<string>();
  for (const w of plan.waves ?? []) {
    for (const id of w.taskIDs) {
      scheduledIds.add(id);
    }
  }
  return plan.tasks
    .filter(t => (t.status === 'pending' || t.status === 'needs_review') && !scheduledIds.has(t.id))
    .map(t => t.id);
}

function validateDependencies(tasks: TaskItemInput[] | TaskItem[]): void {
  const ids = new Set(tasks.map(t => t.id));
  for (const t of tasks) {
    for (const dep of t.dependsOn) {
      if (!ids.has(dep)) {
        throw new Error(`Task "${t.id}" depends on "${dep}" which does not exist`);
      }
    }
  }
}

function trackEditedFiles(plan: TaskPlan, tasks: TaskItem[]): void {
  for (const task of tasks) {
    if (task.status === 'completed' && task.files) {
      for (const f of task.files) {
        if (!plan.editedFiles.includes(f)) {
          plan.editedFiles.push(f);
        }
      }
    }
  }
}

async function delegateWaveTasks(
  client: MinimalClient,
  plan: TaskPlan,
  wave: Wave,
  sessionID: string,
  directory: string,
): Promise<void> {
  const dispatchResults = await Promise.allSettled(
    wave.tasks.map(async (task) => {
      task.status = 'running';
      const prompt = buildTaskPrompt(task, plan);
      const sid = await delegateAsync(client, {
        agent: task.agent,
        description: task.description,
        prompt,
        sessionID,
        directory,
      });
      // delegateAsync returns error string on failure — detect and fail task directly
      if (typeof sid === 'string' && sid.startsWith('ERROR:')) {
        task.status = 'failed';
        task.error = sid;
        return;
      }
      task.sessionID = sid;
      recordTaskRef(sid, {
        sessionID: sid,
        directory,
        agent: task.agent,
        description: task.description,
      });
    }),
  );

  for (let i = 0; i < dispatchResults.length; i++) {
    const r = dispatchResults[i];
    if (r.status === 'rejected') {
      const task = wave.tasks[i];
      task.status = 'failed';
      task.error = r.reason instanceof Error ? r.reason.message : String(r.reason);
    }
  }
}

async function pollWaveTasks(
  client: MinimalClient,
  tasks: TaskItem[],
  directory: string,
): Promise<{ allDone: boolean; changed: boolean }> {
  const running = tasks.filter(t => t.status === 'running' && t.sessionID);
  let changed = false;

  const results = await Promise.allSettled(
    running.map(t => getSubagentResult(client, t.sessionID!, directory)),
  );

  for (let i = 0; i < running.length; i++) {
    const task = running[i];
    const r = results[i];

    if (r.status === 'rejected') {
      task.status = 'failed';
      task.error = r.reason instanceof Error ? r.reason.message : String(r.reason);
      changed = true;
      continue;
    }

    const sub = r.value;
    if (sub.status === 'completed') {
      // Parse AGNES envelope to check for BLOCKED status
      let isBlocked = false;
      let blockedReason = '';
      if (sub.output) {
        const envelope = sub.output.match(/\xA7AM\{.*\}/);
        if (envelope) {
          const parsed = parseAgnesMessage(envelope[0]);
          if (parsed && (parsed as unknown as Record<string, unknown>).status === 'BLOCKED') {
            isBlocked = true;
            blockedReason = String((parsed as unknown as Record<string, unknown>).content ?? 'Subagent reported BLOCKED');
          }
        }
      }

      if (isBlocked) {
        task.error = blockedReason;
        task.status = 'failed';
        changed = true;
      } else {
        task.result = sub.output;
        task.status = 'completed';
        changed = true;
        const lessonMatch = sub.output?.match(/LESSON:\s*(.+)/);
        if (lessonMatch) {
          logger.info(`Lesson from task ${task.id}: ${lessonMatch[1]}`);
        }
      }
    } else if (sub.status === 'error') {
      task.error = sub.error;
      task.status = 'failed';
      changed = true;
    }
  }

  const allDone = tasks.every(t => t.status === 'completed' || t.status === 'failed');
  return { allDone, changed };
}

export async function createOrchestration(
  client: MinimalClient,
  params: OrchestrationParams,
): Promise<OrchestrationResult> {
  const tier = detectModelTier();
  const maxParallel = getMaxConcurrency(tier);
  const maxIter = params.maxIterations ?? 3;

  const RESERVED_PREFIXES = ['_', 'sys', 'meta'];

  function normalizeTaskIDs(
    input: TaskItemInput[],
    existingIDs: Set<string>,
  ): { tasks: TaskItemInput[]; idMap: Map<string, string> } {
    const result: TaskItemInput[] = [];
    const idMap = new Map<string, string>();

    // First pass: normalize all IDs and build the full mapping
    for (const t of input) {
      const rawId = typeof t.id === 'string' && t.id ? t.id : '';

      let newId: string;
      if (!rawId) {
        newId = generateTaskID();
      } else if (existingIDs.has(rawId) || RESERVED_PREFIXES.some(p => rawId.startsWith(p))) {
        if (existingIDs.has(rawId)) {
          logger.warn(`Duplicate task ID "${rawId}" — generating new ID`);
        } else {
          logger.warn(`Task ID "${rawId}" uses reserved prefix — generating new ID`);
        }
        newId = generateTaskID();
      } else {
        newId = rawId;
      }

      while (existingIDs.has(newId)) {
        newId = generateTaskID();
      }
      existingIDs.add(newId);

      if (rawId && rawId !== newId) {
        idMap.set(rawId, newId);
      }

      result.push({
        id: newId,
        description: typeof t.description === 'string' && t.description ? t.description : `Task ${result.length + 1}`,
        files: Array.isArray(t.files) ? t.files : [],
        dependsOn: Array.isArray(t.dependsOn) ? [...t.dependsOn] : [],
        agent: t.agent === 'explore' ? 'explore' : 'general',
        acceptanceCriteria: typeof t.acceptanceCriteria === 'string' ? t.acceptanceCriteria : undefined,
      });
    }

    // Second pass: rewrite dependsOn using the complete idMap
    for (const t of result) {
      t.dependsOn = t.dependsOn.map(d => idMap.get(d) ?? d);
    }

    return { tasks: result, idMap };
  }

  function splitPlanIfNeeded(plan: TaskPlan): TaskPlan {
    const MAX_TASKS = 50;
    if (plan.tasks.length <= MAX_TASKS) return plan;

    // Large plans are handled as many waves — keep all tasks in one plan
    logger.info(`Large plan: ${plan.tasks.length} tasks — all will be scheduled across waves`);
    return plan;
  }

  let plan: TaskPlan;

  if (params.planID) {
    const loaded = loadPlan(params.planID, params.directory);
    if (!loaded) {
      return {
        planID: params.planID,
        goal: '(unknown)',
        phase: 'failed',
        iterations: 0,
        maxIterations: maxIter,
        totalTasks: 0,
        completedTasks: 0,
        runningTasks: 0,
        failedTasks: 0,
        editedFiles: [],
        currentWave: 0,
        totalWaves: 0,
        passed: false,
        pendingCalls: 0,
        error: `Plan "${params.planID}" not found`,
      };
    }
    plan = loaded;
    plan.sessionID = params.sessionID;
    try {
      validateDependencies(plan.tasks);
    } catch (err) {
      return {
        planID: params.planID,
        goal: plan.goal,
        phase: 'failed',
        iterations: 0,
        maxIterations: maxIter,
        totalTasks: plan.tasks.length,
        completedTasks: 0,
        runningTasks: 0,
        failedTasks: 0,
        editedFiles: [],
        currentWave: 0,
        totalWaves: 0,
        passed: false,
        pendingCalls: 0,
        error: `Loaded plan has invalid dependencies: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  } else {
    plan = createPlan(params.goal, maxIter);
    plan.sessionID = params.sessionID;

    const seenIDs = new Set<string>();
    const inputTasks = params.tasks && params.tasks.length > 0 ? params.tasks : null;

    if (inputTasks) {
      const { tasks: normalized } = normalizeTaskIDs(inputTasks, seenIDs);
      try {
        validateDependencies(normalized);
      } catch (err) {
        return {
          planID: plan.id,
          goal: plan.goal,
          phase: 'failed',
          iterations: 0,
          maxIterations: maxIter,
          totalTasks: 0,
          completedTasks: 0,
          runningTasks: 0,
          failedTasks: 0,
          editedFiles: [],
          currentWave: 0,
          totalWaves: 0,
          passed: false,
          pendingCalls: 0,
          error: `Invalid task dependencies: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      plan.tasks = normalized.map(t => ({
        ...t,
        status: 'pending' as const,
        retryCount: 0,
        result: undefined,
        error: undefined,
        sessionID: undefined,
      }));
    } else {
      // No tasks provided — auto-decompose the goal
      try {
        const decomposed = await decomposeGoal(client, params.goal, params.sessionID, params.directory);
        const { tasks: normalized } = normalizeTaskIDs(decomposed, seenIDs);
        validateDependencies(normalized);
        plan.tasks = normalized.map(t => ({
          ...t,
          status: 'pending' as const,
          retryCount: 0,
          result: undefined,
          error: undefined,
          sessionID: undefined,
        }));
        logger.info(`Auto-decomposed goal into ${plan.tasks.length} tasks`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          planID: plan.id,
          goal: plan.goal,
          phase: 'failed',
          iterations: 0,
          maxIterations: maxIter,
          totalTasks: 0,
          completedTasks: 0,
          runningTasks: 0,
          failedTasks: 0,
          editedFiles: [],
          currentWave: 0,
          totalWaves: 0,
          passed: false,
          pendingCalls: 0,
          error: `Goal decomposition failed: ${msg}`,
        };
      }
    }

    if (plan.tasks.length === 0) {
      plan.phase = 'failed';
      savePlan(plan, params.directory);
      return {
        planID: plan.id,
        goal: plan.goal,
        phase: 'failed',
        iterations: 0,
        maxIterations: maxIter,
        totalTasks: 0,
        completedTasks: 0,
        runningTasks: 0,
        failedTasks: 0,
        editedFiles: [],
        currentWave: 0,
        totalWaves: 0,
        passed: false,
        pendingCalls: 0,
        error: 'No tasks provided and goal decomposition returned zero tasks',
      };
    }

    splitPlanIfNeeded(plan);

    const waves = buildSchedule(plan.tasks, maxParallel);
    plan.waves = waves.map(w => ({ index: w.index, taskIDs: w.tasks.map(t => t.id) }));
    plan.currentWaveIndex = 0;

    const unscheduled = validateScheduleComplete(plan);
    if (unscheduled.length > 0) {
      plan.phase = 'failed';
      savePlan(plan, params.directory);
      return {
        planID: plan.id,
        goal: plan.goal,
        phase: 'failed',
        iterations: 0,
        maxIterations: maxIter,
        totalTasks: plan.tasks.length,
        completedTasks: 0,
        runningTasks: 0,
        failedTasks: 0,
        editedFiles: [],
        currentWave: 0,
        totalWaves: 0,
        passed: false,
        pendingCalls: unscheduled.length,
        error: `Unscheduled tasks after wave build: ${unscheduled.join(', ')}`,
      };
    }
  }

  if (!plan.waves || plan.waves.length === 0) {
    if (plan.tasks.length > 0) {
      plan.phase = 'failed';
      savePlan(plan, params.directory);
      return {
        planID: plan.id,
        goal: plan.goal,
        phase: 'failed',
        iterations: 0,
        maxIterations: maxIter,
        totalTasks: plan.tasks.length,
        completedTasks: 0,
        runningTasks: 0,
        failedTasks: 0,
        editedFiles: [],
        currentWave: 0,
        totalWaves: 0,
        passed: false,
        pendingCalls: 0,
        error: `Tasks exist (${plan.tasks.length}) but scheduler could not order them — check for circular dependencies or unresolvable file conflicts`,
      };
    }
    plan.phase = 'failed';
    savePlan(plan, params.directory);
    return {
      planID: plan.id,
      goal: plan.goal,
      phase: 'failed',
      iterations: 0,
      maxIterations: maxIter,
      totalTasks: 0,
      completedTasks: 0,
      runningTasks: 0,
      failedTasks: 0,
      editedFiles: [],
      currentWave: 0,
      totalWaves: 0,
      passed: false,
      pendingCalls: 0,
      error: 'No tasks — nothing to orchestrate',
    };
  }

  if (plan.phase === 'pending' || plan.phase === 'scheduling') {
    plan.phase = 'running';
    const wave0 = plan.waves[0];
    const waveTasks = wave0.taskIDs
      .map(id => plan.tasks.find(t => t.id === id))
      .filter(Boolean) as TaskItem[];

    const wave: Wave = { index: 0, tasks: waveTasks };
    await delegateWaveTasks(client, plan, wave, params.sessionID, params.directory);
    savePlan(plan, params.directory);
  }

  return buildResult(plan);
}

export async function advanceOrchestration(
  client: MinimalClient,
  planID: string,
  directory: string,
  sessionID: string,
): Promise<OrchestrationResult> {
  const plan = loadPlan(planID, directory);
  if (!plan) {
    return {
      planID,
      goal: '(unknown)',
      phase: 'failed',
      iterations: 0,
      maxIterations: 3,
      totalTasks: 0,
      completedTasks: 0,
      runningTasks: 0,
      failedTasks: 0,
      editedFiles: [],
      currentWave: 0,
      totalWaves: 0,
      passed: false,
      pendingCalls: 0,
      error: `Plan "${planID}" not found`,
    };
  }

  if (plan.phase === 'completed' || plan.phase === 'failed') {
    return buildResult(plan);
  }

  try {
    validateDependencies(plan.tasks);
  } catch (err) {
    return {
      planID,
      goal: plan.goal,
      phase: 'failed',
      iterations: plan.iteration,
      maxIterations: plan.maxIterations,
      totalTasks: plan.tasks.length,
      completedTasks: 0,
      runningTasks: 0,
      failedTasks: 0,
      editedFiles: [...plan.editedFiles],
      currentWave: 0,
      totalWaves: 0,
      passed: false,
      pendingCalls: 0,
      error: `Loaded plan has invalid dependencies: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!plan.waves || plan.waves.length === 0) {
    // No waves exist — try to schedule from scratch
    if (plan.tasks.length > 0) {
      const waves = buildSchedule(plan.tasks, getMaxConcurrency(detectModelTier()));
      plan.waves = waves.map(w => ({ index: w.index, taskIDs: w.tasks.map(t => t.id) }));
      plan.currentWaveIndex = 0;
      const rawUnscheduled = validateScheduleComplete(plan);
      if (rawUnscheduled.length > 0) {
        plan.phase = 'failed';
        updatePlan(plan, directory);
        const schedResult = buildResult(plan);
        schedResult.error = `Tasks could not be scheduled: ${rawUnscheduled.join(', ')}`;
        return schedResult;
      }
      if (waves.length > 0) {
        plan.phase = 'running';
        const waveZeroDef = plan.waves[0];
        const waveZeroTasks = waveZeroDef.taskIDs
          .map(id => plan.tasks.find(t => t.id === id))
          .filter(Boolean) as TaskItem[];
        const waveZero: Wave = { index: 0, tasks: waveZeroTasks };
        await delegateWaveTasks(client, plan, waveZero, sessionID, directory);
        updatePlan(plan, directory);
        return buildResult(plan);
      }
      plan.phase = 'failed';
      updatePlan(plan, directory);
      const schedResult = buildResult(plan);
      schedResult.error = `Tasks exist (${plan.tasks.length}) but could not be scheduled — check for circular dependencies`;
      return schedResult;
    }
    plan.phase = 'completed';
    updatePlan(plan, directory);
    return buildResult(plan);
  }

  const waveIdx = plan.currentWaveIndex ?? 0;
  if (waveIdx >= plan.waves.length) {
    plan.phase = 'completed';
    updatePlan(plan, directory);
    return buildResult(plan);
  }

  const waveDef = plan.waves[waveIdx];
  const waveTasks = waveDef.taskIDs
    .map(id => plan.tasks.find(t => t.id === id))
    .filter(Boolean) as TaskItem[];

  if (waveTasks.length === 0) {
    plan.currentWaveIndex = waveIdx + 1;
    if (plan.currentWaveIndex >= plan.waves.length) {
      plan.phase = 'completed';
    } else {
      const nextWaveDef = plan.waves[plan.currentWaveIndex];
      const nextTasks = nextWaveDef.taskIDs
        .map(id => plan.tasks.find(t => t.id === id))
        .filter(Boolean) as TaskItem[];
      const nextWave: Wave = { index: plan.currentWaveIndex, tasks: nextTasks };
      await delegateWaveTasks(client, plan, nextWave, sessionID, directory);
    }
    updatePlan(plan, directory);
    return buildResult(plan);
  }

  const { allDone } = await pollWaveTasks(client, waveTasks, directory);

  if (!allDone) {
    updatePlan(plan, directory);
    return buildResult(plan);
  }

  trackEditedFiles(plan, waveTasks);

  let verdict: ReviewVerdict;
  try {
    verdict = await runReview(plan);
  } catch (err) {
    plan.phase = 'failed';
    updatePlan(plan, directory);
    const errResult = buildResult(plan);
    errResult.error = `Review gate threw: ${err instanceof Error ? err.message : String(err)}`;
    return errResult;
  }

  if (verdict.passed) {
    if (waveIdx + 1 < plan.waves.length) {
      plan.currentWaveIndex = waveIdx + 1;
      const nextWaveDef = plan.waves[plan.currentWaveIndex];
      const nextTasks = nextWaveDef.taskIDs
        .map(id => plan.tasks.find(t => t.id === id))
        .filter(Boolean) as TaskItem[];
      const nextWave: Wave = { index: plan.currentWaveIndex, tasks: nextTasks };
      await delegateWaveTasks(client, plan, nextWave, sessionID, directory);
    } else {
      plan.phase = 'completed';
    }
  } else {
    const failed = getFailedTasks(plan);
    if (failed.length === 0) {
      plan.phase = 'completed';
    } else if (plan.iteration < plan.maxIterations - 1) {
      plan.iteration++;
      // Reset any orphaned running tasks (their sessions are from a previous wave)
      for (const task of plan.tasks) {
        if (task.status === 'running') {
          task.status = 'failed';
          task.error = 'Orphaned from previous wave retry';
        }
      }
      logger.info(`Review failed, re-delegating ${failed.length} task(s) (iteration ${plan.iteration + 1}/${plan.maxIterations})`);
      for (const task of failed) {
        task.status = 'pending';
        task.retryCount++;
        task.sessionID = undefined;
        task.result = undefined;
        task.error = undefined;
      }
      const waves = buildSchedule(plan.tasks, getMaxConcurrency(detectModelTier()));
      plan.waves = waves.map(w => ({ index: w.index, taskIDs: w.tasks.map(t => t.id) }));
      plan.currentWaveIndex = 0;
      const unscheduled = validateScheduleComplete(plan);
      if (unscheduled.length > 0) {
        plan.phase = 'failed';
        updatePlan(plan, directory);
        const retryResult = buildResult(plan);
        retryResult.error = `Unscheduled tasks after retry: ${unscheduled.join(', ')}`;
        return retryResult;
      }
      if (plan.waves.length > 0) {
        const retryWaveDef = plan.waves[0];
        const retryTasks = retryWaveDef.taskIDs
          .map(id => plan.tasks.find(t => t.id === id))
          .filter(Boolean) as TaskItem[];
        const retryWave: Wave = { index: 0, tasks: retryTasks };
        await delegateWaveTasks(client, plan, retryWave, sessionID, directory);
      }
    } else {
      plan.phase = 'failed';
    }
  }

  updatePlan(plan, directory);
  return buildResult(plan);
}

function buildResult(plan: TaskPlan): OrchestrationResult {
  const allTasks = plan.tasks;
  const completed = allTasks.filter(t => t.status === 'completed').length;
  const running = allTasks.filter(t => t.status === 'running').length;
  const failed = allTasks.filter(t => t.status === 'failed').length;
  const pending = allTasks.filter(t => t.status === 'pending' || t.status === 'needs_review').length;
  const waveCount = plan.waves?.length ?? 0;

  const passed = plan.phase === 'completed' && failed === 0 && pending === 0 && running === 0;

  return {
    planID: plan.id,
    goal: plan.goal,
    phase: plan.phase,
    iterations: plan.iteration,
    maxIterations: plan.maxIterations,
    totalTasks: allTasks.length,
    completedTasks: completed,
    runningTasks: running,
    failedTasks: failed,
    editedFiles: [...plan.editedFiles],
    currentWave: (plan.currentWaveIndex ?? 0) + 1,
    totalWaves: waveCount,
    passed,
    pendingCalls: pending,
  };
}

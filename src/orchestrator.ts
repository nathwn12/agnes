import type { TaskPlan, TaskItem } from './planner.js';
import {
  createPlan,
  savePlan,
  updatePlan,
  loadPlan,
  getFailedTasks,
} from './planner.js';
import { buildSchedule } from './scheduler.js';
import type { Wave } from './scheduler.js';
import { runReview } from './reviewer.js';
import type { ReviewVerdict } from './reviewer.js';
import { delegateAsync, recordTaskRef, getSubagentResult } from './delegate.js';
import { getMaxConcurrency, detectModelTier } from './runtime.js';
import * as logger from './logger.js';

type MinimalClient = any;

export interface OrchestrationParams {
  goal: string;
  tasks?: TaskItemInput[];
  planID?: string;
  maxIterations?: number;
  sessionID: string;
  directory: string;
}

export interface TaskItemInput {
  id: string;
  description: string;
  files: string[];
  dependsOn: string[];
  agent: 'explore' | 'general';
}

export interface OrchestrationResult {
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
  return `You are implementing ONE task in a larger plan.

## Goal
${plan.goal}

## Your task
${task.description}

## Files to edit
${task.files.join(', ')}

## Instructions
1. Implement exactly what's described above. No more, no less.
2. Write tests for your changes if applicable.
3. Run tests to verify they pass.
4. Report what you did and which files you created or modified.

## Completion protocol
When done, append at the end of your response:

<!-- <agnes:message taskId="${task.id}" status="DONE" content="SUMMARY">taskId=${task.id} status=DONE files=${task.files.join(',')}</agnes:message> -->

Replace SUMMARY with a brief summary of what you implemented.
Report DONE if everything works. Report BLOCKED if you cannot proceed.
`;
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
      task.result = sub.output;
      task.status = 'completed';
      changed = true;
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
  } else {
    plan = createPlan(params.goal, maxIter);
    plan.sessionID = params.sessionID;

    if (params.tasks && params.tasks.length > 0) {
      plan.tasks = params.tasks.map(t => ({
        ...t,
        status: 'pending' as const,
        retryCount: 0,
        result: undefined,
        error: undefined,
        sessionID: undefined,
      }));
    }

    const waves = buildSchedule(plan.tasks, maxParallel);
    plan.waves = waves.map(w => ({ index: w.index, taskIDs: w.tasks.map(t => t.id) }));
    plan.currentWaveIndex = 0;
  }

  if (!plan.waves || plan.waves.length === 0) {
    plan.phase = 'completed';
    savePlan(plan, params.directory);
    return {
      planID: plan.id,
      goal: plan.goal,
      phase: 'completed',
      iterations: 0,
      maxIterations: maxIter,
      totalTasks: plan.tasks.length,
      completedTasks: 0,
      runningTasks: 0,
      failedTasks: 0,
      editedFiles: [],
      currentWave: 0,
      totalWaves: 0,
      passed: true,
      pendingCalls: 0,
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

  if (!plan.waves || plan.waves.length === 0) {
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

  const verdict: ReviewVerdict = await runReview(plan);

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

  const passed = plan.phase === 'completed' && failed === 0;

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

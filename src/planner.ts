import * as fs from 'node:fs';
import * as path from 'node:path';

export type PlanPhase = 'pending' | 'decomposing' | 'scheduling' | 'executing' | 'reviewing' | 'running' | 'completed' | 'failed';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'needs_review';

export interface TaskItem {
  id: string;
  description: string;
  files: string[];
  dependsOn: string[];
  agent: 'explore' | 'general';
  status: TaskStatus;
  result?: string;
  error?: string;
  sessionID?: string;
  retryCount: number;
}

export interface WaveDef {
  index: number;
  taskIDs: string[];
}

export interface TaskPlan {
  id: string;
  goal: string;
  phase: PlanPhase;
  tasks: TaskItem[];
  iteration: number;
  maxIterations: number;
  startTime: number;
  editedFiles: string[];
  waves?: WaveDef[];
  currentWaveIndex?: number;
  sessionID?: string;
}

const PLANS_DIR = '.opencode/plans';

let _idCounter = 0;

export function generatePlanID(): string {
  return `plan-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
}

export function generateTaskID(): string {
  return `task-${(++_idCounter).toString(36).padStart(4, '0')}`;
}

function getPlansDir(worktreePath: string): string {
  return path.join(worktreePath, PLANS_DIR);
}

export function createPlan(goal: string, maxIterations = 3): TaskPlan {
  return {
    id: generatePlanID(),
    goal,
    phase: 'pending',
    tasks: [],
    iteration: 0,
    maxIterations,
    startTime: Date.now(),
    editedFiles: [],
    waves: [],
    currentWaveIndex: 0,
    sessionID: undefined,
  };
}

export function savePlan(plan: TaskPlan, worktreePath: string): void {
  const dir = getPlansDir(worktreePath);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${plan.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(plan, null, 2), 'utf8');
}

export function loadPlan(planID: string, worktreePath: string): TaskPlan | null {
  const filePath = path.join(getPlansDir(worktreePath), `${planID}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as TaskPlan;
  } catch {
    return null;
  }
}

export function updatePlan(plan: TaskPlan, worktreePath: string): void {
  savePlan(plan, worktreePath);
}

export function deletePlan(planID: string, worktreePath: string): void {
  const filePath = path.join(getPlansDir(worktreePath), `${planID}.json`);
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // ignore
  }
}

export function findTasksByFile(plan: TaskPlan, filePath: string): TaskItem[] {
  return plan.tasks.filter(t => t.files.includes(filePath));
}

export function getFailedTasks(plan: TaskPlan): TaskItem[] {
  return plan.tasks.filter(t => t.status === 'failed' || t.status === 'needs_review');
}

export function getCompletedTasks(plan: TaskPlan): TaskItem[] {
  return plan.tasks.filter(t => t.status === 'completed');
}

export function getRunningTasks(plan: TaskPlan): TaskItem[] {
  return plan.tasks.filter(t => t.status === 'running');
}

export function getPendingTasks(plan: TaskPlan): TaskItem[] {
  return plan.tasks.filter(t => t.status === 'pending');
}

export function hasPendingOrRunning(plan: TaskPlan): boolean {
  return plan.tasks.some(t => t.status === 'pending' || t.status === 'running');
}

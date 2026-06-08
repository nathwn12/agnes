import type { TaskPlan } from './planner.js';
import { runGates } from './verification.js';
import type { Gate, GateResult } from './verification.js';

export interface ReviewVerdict {
  passed: boolean;
  results: GateResult[];
  failedGates: GateResult[];
  failedTaskIds: string[];
}

function createCompletionGate(plan: TaskPlan): Gate {
  return {
    id: 'orchestrator-completion',
    name: 'Task Completion',
    description: 'All tasks must be in completed status',
    isBlocking: true,
    run: async () => {
      const start = Date.now();
      const failed = plan.tasks.filter(t => t.status !== 'completed');
      const errors = failed.map(
        t =>
          `Task ${t.id} ("${t.description}"): status = ${t.status}${t.error ? `, error = ${t.error}` : ''}`,
      );
      return {
        gateId: 'orchestrator-completion',
        status: errors.length === 0 ? 'PASS' : 'FAIL',
        evidence: { errors },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    },
  };
}

function createFileConflictGate(plan: TaskPlan): Gate {
  return {
    id: 'orchestrator-file-conflict',
    name: 'File Conflict',
    description: 'No two tasks edited overlapping files without coordination',
    isBlocking: true,
    run: async () => {
      const start = Date.now();
      const errors: string[] = [];

      const fileOwners = new Map<string, string[]>();
      for (const t of plan.tasks) {
        if (t.status !== 'completed') continue;
        for (const f of t.files) {
          if (!fileOwners.has(f)) fileOwners.set(f, []);
          fileOwners.get(f)!.push(t.id);
        }
      }

      for (const [file, owners] of fileOwners) {
        if (owners.length > 1) {
          errors.push(
            `File "${file}" was edited by multiple tasks: ${owners.join(', ')}`,
          );
        }
      }

      return {
        gateId: 'orchestrator-file-conflict',
        status: errors.length === 0 ? 'PASS' : 'FAIL',
        evidence: { errors },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    },
  };
}

function extractFailedTaskIds(plan: TaskPlan): string[] {
  return plan.tasks
    .filter(t => t.status === 'failed' || t.status === 'needs_review')
    .map(t => t.id);
}

export async function runReview(plan: TaskPlan): Promise<ReviewVerdict> {
  const completionGate = createCompletionGate(plan);
  const conflictGate = createFileConflictGate(plan);

  const gates: Gate[] = [completionGate, conflictGate];

  const results = await runGates(gates);
  const failedGates = results.filter(r => r.status === 'FAIL');
  const passed = failedGates.length === 0;

  const failedTaskIds = extractFailedTaskIds(plan);

  return { passed, results, failedGates, failedTaskIds };
}

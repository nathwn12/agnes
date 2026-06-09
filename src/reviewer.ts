import type { TaskPlan } from './planner.js';
import { runGates } from './verification.js';
import type { Gate, GateResult } from './verification.js';
import { hasCompletionSignal } from './verification.js';

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
      const failed = plan.tasks.filter(t => t.status !== 'completed' && t.status !== 'pending');
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

function createEnvelopeGate(plan: TaskPlan): Gate {
  return {
    id: 'orchestrator-envelope',
    name: 'Completion Envelope',
    description: 'Each completed task output must contain a valid AGNES completion envelope',
    isBlocking: false,
    run: async () => {
      const start = Date.now();
      const errors: string[] = [];
      const affected: string[] = [];
      for (const t of plan.tasks) {
        if (t.status !== 'completed' || !t.result) continue;
        if (!hasCompletionSignal(t.result)) {
          errors.push(`Task ${t.id} ("${t.description}"): output is missing AGNES completion envelope`);
          affected.push(t.id);
        }
      }
      return {
        gateId: 'orchestrator-envelope',
        status: errors.length === 0 ? 'PASS' : 'FAIL',
        evidence: { errors },
        affectedTaskIds: affected,
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
  const envelopeGate = createEnvelopeGate(plan);

  const gates: Gate[] = [completionGate, envelopeGate];

  let results: GateResult[];
  try {
    results = await runGates(gates);
  } catch (err) {
    // Blocking gate threw — catch here so orchestrator retry path is used instead of plan failure
    results = [{
      gateId: 'orchestrator-completion',
      status: 'FAIL',
      evidence: { errors: [err instanceof Error ? err.message : String(err)] },
      timestamp: new Date().toISOString(),
      durationMs: 0,
    }];
  }

  // Propagate envelope gate failures to task status
  // (completion gate failures are structural — retry won't help)
  for (const result of results) {
    if (result.status === 'FAIL' && result.affectedTaskIds && result.gateId === 'orchestrator-envelope') {
      for (const taskId of result.affectedTaskIds) {
        const task = plan.tasks.find(t => t.id === taskId);
        if (task?.status === 'completed') {
          task.status = 'needs_review';
        }
      }
    }
  }

  const failedGates = results.filter(r => r.status === 'FAIL');
  const passed = failedGates.length === 0;

  const failedTaskIds = extractFailedTaskIds(plan);

  return { passed, results, failedGates, failedTaskIds };
}

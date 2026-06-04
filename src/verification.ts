import type { GateEvidence } from './schema.js';
import { parseAgnesMessage } from './protocol.js';

type GateStatus = 'PASS' | 'FAIL' | 'SKIP';

export interface GateResult {
  gateId: string;
  status: GateStatus;
  evidence: {
    command?: string;
    exitCode?: number;
    output?: string;
    errors: string[];
  };
  timestamp: string;
  durationMs: number;
}

export interface Gate {
  id: string;
  name: string;
  description: string;
  run: () => Promise<GateResult>;
  isBlocking: boolean;
}

/**
 * Execute all gates in order. If a blocking gate FAILs, stop and return results so far.
 */
export async function runGates(gates: Gate[]): Promise<GateResult[]> {
  const results: GateResult[] = [];
  for (const gate of gates) {
    const start = Date.now();
    let result: GateResult;
    try {
      result = await gate.run();
    } catch (err) {
      result = {
        gateId: gate.id,
        status: 'FAIL',
        evidence: {
          errors: [err instanceof Error ? err.message : String(err)],
        },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }
    results.push(result);
    if (gate.isBlocking && result.status === 'FAIL') {
      break;
    }
  }
  return results;
}

/**
 * Format gate results into a human-readable markdown report.
 */
export function formatGateReport(results: GateResult[]): string {
  const lines: string[] = ['## Verification Gates Report', ''];
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⊘';
    lines.push(`- **${icon} ${r.gateId}** (${r.durationMs}ms)`);
    if (r.evidence.errors.length > 0) {
      for (const err of r.evidence.errors) {
        lines.push(`  - Error: ${err}`);
      }
    }
  }
  lines.push('');
  const hasFailure = results.some(r => r.status === 'FAIL');
  lines.push(`**Overall: ${hasFailure ? 'FAIL ❌' : 'PASS ✓'}**`);
  return lines.join('\n');
}

export function registerGate(
  gates: Gate[],
  gate: Gate,
): Gate[] {
  return [...gates, gate];
}

function extractCanonicalAgnesMessageEnvelope(text: string): string | null {
  const match = text.match(/<!--\s*<agnes:message>[\s\S]*?<\/agnes:message>\s*-->/);
  return match?.[0] ?? null;
}

function hasCompletionSignal(text: string): boolean {
  const envelope = extractCanonicalAgnesMessageEnvelope(text);
  if (!envelope) return false;
  const parsed = parseAgnesMessage(envelope);
  if (parsed?.type !== 'completion' && parsed?.type !== 'result') return false;
  return (parsed as { schema?: string }).schema === 'agnes/message-v1';
}

export const promiseComplianceGate: Gate = {
  id: 'promise-compliance',
  name: 'Promise Compliance',
  description: 'Checks that output contains a canonical HTML-commented completion or result <agnes:message> before allowing completion',
  isBlocking: true,
  run: async () => {
    const start = Date.now();
    const errors: string[] = [];
    const output = process.env.AGNES_LAST_OUTPUT || '';
    if (!hasCompletionSignal(output)) {
      errors.push('Output does not contain a valid canonical HTML-commented completion or result <agnes:message> with schema agnes/message-v1');
    }
    return {
      gateId: 'promise-compliance',
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      evidence: { errors, command: 'check-completion-signal', exitCode: errors.length === 0 ? 0 : 1, output },
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  },
};

export function createPromiseComplianceGate(output: string): Gate {
  return {
    id: 'promise-compliance',
    name: 'Promise Compliance',
    description: 'Checks that output contains a canonical HTML-commented completion or result <agnes:message>',
    isBlocking: true,
    run: async () => {
      const start = Date.now();
      const errors: string[] = [];
      if (!hasCompletionSignal(output)) {
        errors.push('Output does not contain a valid canonical HTML-commented completion or result <agnes:message> with schema agnes/message-v1');
      }
      return {
        gateId: 'promise-compliance',
        status: errors.length === 0 ? 'PASS' : 'FAIL',
        evidence: { errors, command: 'check-completion-signal', exitCode: errors.length === 0 ? 0 : 1, output },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    },
  };
}

export function createPlanExistsGate(projectRoot?: string): Gate {
  return {
    id: 'plan-exists',
    name: 'Plan Exists',
    description: 'Checks that .agnes/index.json has an active plan',
    isBlocking: true,
    run: async () => {
      const start = Date.now();
      const errors: string[] = [];
      try {
        const fs = await import('fs/promises');
        const basePath = projectRoot ?? process.cwd();
        const content = await fs.readFile(`${basePath}/.agnes/index.json`, 'utf-8');
        const index = JSON.parse(content);
        if (!index.activePlanId) {
          errors.push('No active plan found in .agnes/index.json');
        } else {
          const activePlan = Array.isArray(index.plans)
            ? index.plans.find((plan: { id?: unknown }) => plan.id === index.activePlanId)
            : undefined;
          if (!activePlan) {
            errors.push(`Active plan ${index.activePlanId} was not found`);
          } else if (activePlan.status !== 'approved') {
            errors.push(`Active plan ${index.activePlanId} is ${String(activePlan.status)}; expected approved`);
          }
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
      return {
        gateId: 'plan-exists',
        status: errors.length === 0 ? 'PASS' : 'FAIL',
        evidence: { errors, command: 'check-active-plan', exitCode: errors.length === 0 ? 0 : 1 },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    },
  };
}

export const planExistsGate: Gate = {
  id: 'plan-exists',
  name: 'Plan Exists',
  description: 'Checks that .agnes/index.json has an active plan',
  isBlocking: true,
  run: async () => {
    const start = Date.now();
    const errors: string[] = [];
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile('.agnes/index.json', 'utf-8');
      const index = JSON.parse(content);
      if (!index.activePlanId) {
        errors.push('No active plan found in .agnes/index.json');
      } else {
        const activePlan = Array.isArray(index.plans)
          ? index.plans.find((plan: { id?: unknown }) => plan.id === index.activePlanId)
          : undefined;
        if (!activePlan) {
          errors.push(`Active plan ${index.activePlanId} was not found in .agnes/index.json plans`);
        } else if (activePlan.status !== 'approved') {
          errors.push(`Active plan ${index.activePlanId} is ${String(activePlan.status)}; expected approved`);
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    return {
      gateId: 'plan-exists',
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      evidence: { errors, command: 'check-active-plan', exitCode: errors.length === 0 ? 0 : 1 },
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  },
};

export const stateFileIntegrityGate: Gate = {
  id: 'state-file-integrity',
  name: 'State File Integrity',
  description: 'Checks that .agnes/ state files are valid JSON',
  isBlocking: false,
  run: async () => {
    const start = Date.now();
    const errors: string[] = [];
    try {
      const fs = await import('fs/promises');
      const files = ['.agnes/index.json', '.agnes/config.json'];
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          JSON.parse(content);
        } catch {
          errors.push(`${file} is not valid JSON or does not exist`);
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    return {
      gateId: 'state-file-integrity',
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      evidence: { errors, command: 'validate-state-files', exitCode: errors.length === 0 ? 0 : 1 },
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  },
};

export function gateResultToEvidence(result: GateResult): GateEvidence {
  return {
    gateId: result.gateId,
    status: result.status,
    evidence: {
      errors: result.evidence.errors,
      command: result.evidence.command,
      exitCode: result.evidence.exitCode,
      output: result.evidence.output,
    },
    timestamp: result.timestamp,
    durationMs: result.durationMs,
  };
}

/** True if all results have PASS or SKIP status, false otherwise. */
export function allGatesPassed(results: GateResult[]): boolean {
  return results.every(r => r.status === 'PASS' || r.status === 'SKIP');
}


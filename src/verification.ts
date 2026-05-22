export type GateStatus = 'PASS' | 'FAIL' | 'SKIP';

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

/** True if all results have PASS or SKIP status, false otherwise. */
export function allGatesPassed(results: GateResult[]): boolean {
  return results.every(r => r.status === 'PASS' || r.status === 'SKIP');
}

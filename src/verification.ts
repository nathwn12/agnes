import { parseAgnesMessage } from './protocol.js';
import * as logger from './logger.js';

type GateStatus = 'PASS' | 'FAIL' | 'SKIP';

export interface GateResult {
  gateId: string;
  status: GateStatus;
  evidence: { errors: string[] };
  timestamp: string;
  durationMs: number;
}

export interface Gate {
  id: string;
  name: string;
  description: string;
  run: () => Promise<GateResult>;
  isBlocking: boolean;
  affectedTaskIds?: string[];
}

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
        evidence: { errors: [err instanceof Error ? err.message : String(err)] },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }
    results.push(result);
    if (result.status === 'FAIL') {
      // Log gate failure but don't block — small models need fluid flow
      logger.warn(`Gate "${gate.id}" failed: ${result.evidence.errors.join('; ')}`);
    }
  }
  return results;
}

export function allGatesPassed(results: GateResult[]): boolean {
  return results.every(r => r.status === 'PASS' || r.status === 'SKIP');
}

function extractCanonicalAgnesMessageEnvelope(text: string): string | null {
  // Accept both old format (<!-- <agnes:message>...) and new compact format (§AM{...})
  if (text.includes('\xA7AM')) {
    const idx = text.indexOf('\xA7AM');
    const endIdx = text.indexOf('}', idx);
    if (endIdx !== -1) return text.slice(idx, endIdx + 1);
  }
  const match = text.match(/<!--\s*<agnes:message>[\s\S]*?<\/agnes:message>\s*-->/);
  return match?.[0] ?? null;
}

function hasCompletionSignal(text: string): boolean {
  const envelope = extractCanonicalAgnesMessageEnvelope(text);
  if (!envelope) return false;
  const parsed = parseAgnesMessage(envelope);
  if (!parsed) return false;
  return parsed.type === 'completion' || parsed.type === 'result';
}

export function createPromiseComplianceGate(output: string): Gate {
  return {
    id: 'promise-compliance',
    name: 'Promise Compliance',
    description: 'Checks that output contains a canonical completion or result <agnes:message>',
    isBlocking: false,
    run: async () => {
      const start = Date.now();
      const errors: string[] = [];
      if (!hasCompletionSignal(output)) {
        errors.push('Missing canonical completion/result message envelope');
      }
      return {
        gateId: 'promise-compliance',
        status: errors.length === 0 ? 'PASS' : 'FAIL',
        evidence: { errors },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    },
  };
}

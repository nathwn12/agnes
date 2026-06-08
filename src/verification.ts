import { parseAgnesMessage } from './protocol.js';
import * as logger from './logger.js';
import type { ModelTier } from './runtime.js';
import { detectModelTier, getGateSkip } from './runtime.js';

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

// ── Gate stats ───────────────────────────────────────────────────────────────────

interface GateStats {
  checksPerformed: number;
  checksPassed: number;
  checksFailed: number;
  retriesPerformed: number;
  lastFailureAt?: string;
}

const _gateStats: GateStats = {
  checksPerformed: 0,
  checksPassed: 0,
  checksFailed: 0,
  retriesPerformed: 0,
};

export function getGateStats(): GateStats {
  return { ..._gateStats };
}

function recordGateResult(status: GateStatus): void {
  _gateStats.checksPerformed++;
  if (status === 'PASS') _gateStats.checksPassed++;
  if (status === 'FAIL') {
    _gateStats.checksFailed++;
    _gateStats.lastFailureAt = new Date().toISOString();
  }
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
    recordGateResult(result.status);

    if (result.status === 'FAIL') {
      const isBlocking = gate.isBlocking && !getGateSkip();
      const msg = `Gate "${gate.id}" failed: ${result.evidence.errors.join('; ')}`;
      if (isBlocking) {
        logger.error(msg);
        throw new Error(msg);
      }
      logger.warn(msg);
    }
  }
  return results;
}

function extractCanonicalAgnesMessageEnvelope(text: string): string | null {
  if (text.includes('\xA7AM')) {
    const idx = text.indexOf('\xA7AM');
    if (idx === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    let started = false;
    for (let i = idx; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"' && !escape) { inString = !inString; continue; }
      if (!inString) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') { depth--; }
        if (started && depth === 0) return text.slice(idx, i + 1);
      }
      escape = false;
    }
    return null;
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

export function createPromiseComplianceGate(output: string, tier?: ModelTier): Gate {
  const modelTier = tier ?? detectModelTier();
  const blocking = modelTier !== 'small' && !getGateSkip();

  return {
    id: 'promise-compliance',
    name: 'Promise Compliance',
    description: 'Checks that output contains a canonical completion or result <agnes:message>',
    isBlocking: blocking,
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

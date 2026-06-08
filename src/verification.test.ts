import { describe, expect, test } from 'bun:test';
import {
  runGates,
  allGatesPassed,
  createPromiseComplianceGate,
} from './verification.js';
import type { Gate, GateResult } from './verification.js';

function makeResult(overrides: Partial<GateResult>): GateResult {
  return {
    gateId: 'test-gate',
    status: 'PASS',
    evidence: { errors: [] },
    timestamp: new Date().toISOString(),
    durationMs: 0,
    ...overrides,
  };
}

describe('runGates', () => {
  test('empty gates list returns success', async () => {
    const results = await runGates([]);
    expect(results).toEqual([]);
  });

  test('all passing gates returns success', async () => {
    const gates: Gate[] = [
      {
        id: 'g1', name: 'gate1', description: 'first', isBlocking: false,
        run: async () => makeResult({ gateId: 'g1', status: 'PASS' }),
      },
      {
        id: 'g2', name: 'gate2', description: 'second', isBlocking: false,
        run: async () => makeResult({ gateId: 'g2', status: 'PASS' }),
      },
    ];
    const results = await runGates(gates);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.status === 'PASS')).toBe(true);
  });

  test('non-blocking gate failure does not stop execution', async () => {
    const gates: Gate[] = [
      {
        id: 'g1', name: 'gate1', description: 'failing', isBlocking: false,
        run: async () => makeResult({ gateId: 'g1', status: 'FAIL', evidence: { errors: ['fail'] } }),
      },
      {
        id: 'g2', name: 'gate2', description: 'second', isBlocking: false,
        run: async () => makeResult({ gateId: 'g2', status: 'PASS' }),
      },
    ];
    const results = await runGates(gates);
    expect(results).toHaveLength(2);
  });

  test('gate run error returns FAIL status', async () => {
    const gates: Gate[] = [
      {
        id: 'err', name: 'error', description: 'throws', isBlocking: false,
        run: async () => { throw new Error('boom'); },
      },
    ];
    const results = await runGates(gates);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('FAIL');
  });
});

describe('allGatesPassed', () => {
  test('returns true when all pass', () => {
    const results: GateResult[] = [
      makeResult({ gateId: 'a', status: 'PASS' }),
      makeResult({ gateId: 'b', status: 'SKIP' }),
    ];
    expect(allGatesPassed(results)).toBe(true);
  });

  test('returns false when any fail', () => {
    const results: GateResult[] = [
      makeResult({ gateId: 'a', status: 'PASS' }),
      makeResult({ gateId: 'b', status: 'FAIL' }),
    ];
    expect(allGatesPassed(results)).toBe(false);
  });
});

describe('createPromiseComplianceGate', () => {
  const newFormatCompletion = () => `\xA7AM{"t":"completion","i":"abc","ts":"2026-01-01T00:00:00.000Z","s":"DONE","m":"done"}`;
  const newFormatResult = () => `\xA7AM{"t":"result","i":"r1","ts":"2026-01-01T00:00:00.000Z","tid":"t1","s":"DONE","c":"ok"}`;
  const oldFormatCompletion = () => `<!-- <agnes:message>${JSON.stringify({ type: 'completion', id: 'abc', timestamp: new Date().toISOString(), status: 'DONE', summary: 'done' })}</agnes:message> -->`;

  test('passes on new compact §AM format completion', async () => {
    const gate = createPromiseComplianceGate(newFormatCompletion());
    const result = await gate.run();
    expect(result.status).toBe('PASS');
  });

  test('passes on new compact §AM format result', async () => {
    const gate = createPromiseComplianceGate(newFormatResult());
    const result = await gate.run();
    expect(result.status).toBe('PASS');
  });

  test('passes on old HTML-commented format completion', async () => {
    const gate = createPromiseComplianceGate(oldFormatCompletion());
    const result = await gate.run();
    expect(result.status).toBe('PASS');
  });

  test('fails when output contains legacy promise tag', async () => {
    const gate = createPromiseComplianceGate('<promise>DONE</promise>');
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });

  test('fails when output has no completion signal', async () => {
    const gate = createPromiseComplianceGate('just some text');
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
    expect(result.evidence.errors).toContain('Missing canonical completion/result message envelope');
  });

  test('fails when output is empty', async () => {
    const gate = createPromiseComplianceGate('');
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });
});

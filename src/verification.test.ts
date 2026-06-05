import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  runGates,
  formatGateReport,
  allGatesPassed,
  registerGate,
  createPromiseComplianceGate,
  createPlanExistsGate,
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
        id: 'a', name: 'A', description: '', isBlocking: false,
        run: async () => makeResult({ gateId: 'a', status: 'PASS' }),
      },
      {
        id: 'b', name: 'B', description: '', isBlocking: false,
        run: async () => makeResult({ gateId: 'b', status: 'PASS' }),
      },
    ];
    const results = await runGates(gates);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.status === 'PASS')).toBe(true);
  });

  test('a failing gate returns failure', async () => {
    const gates: Gate[] = [
      {
        id: 'fail', name: 'Fail', description: '', isBlocking: false,
        run: async () => makeResult({ gateId: 'fail', status: 'FAIL' }),
      },
    ];
    const results = await runGates(gates);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('FAIL');
  });

  test('a blocking gate stops execution of subsequent gates', async () => {
    let secondRan = false;
    const gates: Gate[] = [
      {
        id: 'blocker', name: 'Blocker', description: '', isBlocking: true,
        run: async () => makeResult({ gateId: 'blocker', status: 'FAIL' }),
      },
      {
        id: 'after', name: 'After', description: '', isBlocking: false,
        run: async () => { secondRan = true; return makeResult({ gateId: 'after', status: 'PASS' }); },
      },
    ];
    const results = await runGates(gates);
    expect(results).toHaveLength(1);
    expect(secondRan).toBe(false);
  });

  test('a non-blocking failing gate allows subsequent gates to run', async () => {
    const gates: Gate[] = [
      {
        id: 'non-blocker', name: 'Non-Blocker', description: '', isBlocking: false,
        run: async () => makeResult({ gateId: 'non-blocker', status: 'FAIL' }),
      },
      {
        id: 'after', name: 'After', description: '', isBlocking: false,
        run: async () => makeResult({ gateId: 'after', status: 'PASS' }),
      },
    ];
    const results = await runGates(gates);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('FAIL');
    expect(results[1].status).toBe('PASS');
  });

  test('gates receive correct context', async () => {
    let capturedId = '';
    const gates: Gate[] = [
      {
        id: 'ctx-gate', name: 'Ctx', description: '', isBlocking: false,
        run: async () => { capturedId = 'ctx-gate'; return makeResult({ gateId: 'ctx-gate', status: 'PASS' }); },
      },
    ];
    await runGates(gates);
    expect(capturedId).toBe('ctx-gate');
  });
});

describe('formatGateReport', () => {
  test('returns readable report from gate results', () => {
    const results: GateResult[] = [
      makeResult({ gateId: 'g1', status: 'PASS' }),
      makeResult({ gateId: 'g2', status: 'FAIL', evidence: { errors: ['something went wrong'] } }),
    ];
    const report = formatGateReport(results);
    expect(report).toContain('Verification Gates Report');
    expect(report).toContain('g1');
    expect(report).toContain('g2');
  });

  test('lists passed and failed gates', () => {
    const allPass: GateResult[] = [
      makeResult({ gateId: 'ok', status: 'PASS' }),
    ];
    const passReport = formatGateReport(allPass);
    expect(passReport).toContain('PASS');

    const hasFail: GateResult[] = [
      makeResult({ gateId: 'bad', status: 'FAIL' }),
    ];
    const failReport = formatGateReport(hasFail);
    expect(failReport).toContain('FAIL');
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
  const completion = () => `<!-- <agnes:message>${JSON.stringify({ type: 'completion', id: randomUUID(), timestamp: new Date().toISOString(), status: 'DONE', summary: 'done', schema: 'agnes/message-v1' })}</agnes:message> -->`;
  const resultMessage = () => `<!-- <agnes:message>${JSON.stringify({ type: 'result', id: randomUUID(), taskId: 't1', timestamp: new Date().toISOString(), status: 'DONE', content: 'ok', schema: 'agnes/message-v1' })}</agnes:message> -->`;

  test('fails when output contains legacy promise tag', async () => {
    const gate = createPromiseComplianceGate('<promise>DONE</promise>');
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });

  test('fails when output contains bare agnes:message completion', async () => {
    const gate = createPromiseComplianceGate(`<agnes:message>${JSON.stringify({ type: 'completion', id: randomUUID(), timestamp: new Date().toISOString(), status: 'DONE', summary: 'done', schema: 'agnes/message-v1' })}</agnes:message>`);
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });

  test('fails when output contains HTML-commented agnes:message without schema', async () => {
    const gate = createPromiseComplianceGate(`<!-- <agnes:message>${JSON.stringify({ type: 'completion', id: randomUUID(), timestamp: new Date().toISOString(), status: 'DONE', summary: 'done' })}</agnes:message> -->`);
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });

  test('passes when output contains canonical HTML-commented agnes:message completion', async () => {
    const gate = createPromiseComplianceGate(completion());
    const result = await gate.run();
    expect(result.status).toBe('PASS');
  });

  test('passes when output contains canonical HTML-commented agnes:message result', async () => {
    const gate = createPromiseComplianceGate(resultMessage());
    const result = await gate.run();
    expect(result.status).toBe('PASS');
  });

  test('fails when output contains raw JSON completion without agnes:message envelope', async () => {
    const gate = createPromiseComplianceGate(JSON.stringify({ type: 'completion', id: 'x', timestamp: new Date().toISOString(), status: 'DONE', summary: 'done' }));
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });

  test('fails when output contains fenced JSON completion without agnes:message envelope', async () => {
    const gate = createPromiseComplianceGate(`\`\`\`json\n${JSON.stringify({ type: 'completion', id: 'x', timestamp: new Date().toISOString(), status: 'DONE', summary: 'done' })}\n\`\`\``);
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });

  test('fails when agnes:message completion is malformed', async () => {
    const gate = createPromiseComplianceGate(`<!-- <agnes:message>${JSON.stringify({ type: 'completion', id: randomUUID(), timestamp: new Date().toISOString(), status: 'INVALID', summary: 'bad', schema: 'agnes/message-v1' })}</agnes:message> -->`);
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });

  test('fails when output has no completion signal', async () => {
    const gate = createPromiseComplianceGate('just some text');
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
    expect(result.evidence.errors).toContain('Output does not contain a valid canonical HTML-commented completion or result <agnes:message> with schema agnes/message-v1');
  });

  test('fails when output is empty', async () => {
    const gate = createPromiseComplianceGate('');
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });
});

describe('createPlanExistsGate', () => {
  const originalCwd = process.cwd();
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-create-plan-gate-'));
    fs.mkdirSync(path.join(tempDir, '.agnes'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('fails when no active plan', async () => {
    fs.writeFileSync(path.join(tempDir, '.agnes', 'index.json'), JSON.stringify({ plans: [] }), 'utf8');

    const gate = createPlanExistsGate(tempDir);
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
    expect(result.evidence.errors).toContain('No active plan found in .agnes/index.json');
  });

  test('fails when active plan is not approved', async () => {
    fs.writeFileSync(path.join(tempDir, '.agnes', 'index.json'), JSON.stringify({
      activePlanId: 'plan-001',
      plans: [{ id: 'plan-001', status: 'draft' }],
    }), 'utf8');

    const gate = createPlanExistsGate(tempDir);
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
    expect(result.evidence.errors).toContain('Active plan plan-001 is draft; expected approved');
  });

  test('passes when active plan is approved', async () => {
    fs.writeFileSync(path.join(tempDir, '.agnes', 'index.json'), JSON.stringify({
      activePlanId: 'plan-001',
      plans: [{ id: 'plan-001', status: 'approved' }],
    }), 'utf8');

    const gate = createPlanExistsGate(tempDir);
    const result = await gate.run();
    expect(result.status).toBe('PASS');
  });

  test('fails when index.json does not exist', async () => {
    const gate = createPlanExistsGate(path.join(tempDir, 'nonexistent'));
    const result = await gate.run();
    expect(result.status).toBe('FAIL');
  });
});

describe('registerGate', () => {
  test('adds a gate to the list', () => {
    const gateA: Gate = {
      id: 'gate-a', name: 'Gate A', description: '', isBlocking: false,
      run: async () => makeResult({ gateId: 'gate-a', status: 'PASS' }),
    };
    const gateB: Gate = {
      id: 'gate-b', name: 'Gate B', description: '', isBlocking: false,
      run: async () => makeResult({ gateId: 'gate-b', status: 'PASS' }),
    };
    const gates: Gate[] = [gateA];
    const updated = registerGate(gates, gateB);
    expect(updated).toHaveLength(2);
    expect(updated[1].id).toBe('gate-b');
  });
});

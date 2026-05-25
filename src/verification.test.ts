import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  runGates,
  formatGateReport,
  allGatesPassed,
  registerGate,
  promiseComplianceGate,
  planExistsGate,
  stateFileIntegrityGate,
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

describe('pre-registered gates', () => {
  test('promiseComplianceGate exists and is a function', () => {
    expect(promiseComplianceGate).toBeDefined();
    expect(promiseComplianceGate.id).toBe('promise-compliance');
    expect(typeof promiseComplianceGate.run).toBe('function');
  });

  test('planExistsGate exists and is a function', () => {
    expect(planExistsGate).toBeDefined();
    expect(planExistsGate.id).toBe('plan-exists');
    expect(typeof planExistsGate.run).toBe('function');
  });

  test('stateFileIntegrityGate exists and is a function', () => {
    expect(stateFileIntegrityGate).toBeDefined();
    expect(stateFileIntegrityGate.id).toBe('state-file-integrity');
    expect(typeof stateFileIntegrityGate.run).toBe('function');
  });
});

describe('promiseComplianceGate acceptance', () => {
  const OLD_ENV = process.env.AGNES_LAST_OUTPUT;

  afterEach(() => {
    process.env.AGNES_LAST_OUTPUT = OLD_ENV;
  });

  test('passes when output contains legacy <promise> tag', async () => {
    process.env.AGNES_LAST_OUTPUT = '<promise>DONE</promise>';
    const result = await promiseComplianceGate.run();
    expect(result.status).toBe('PASS');
  });

  test('passes when output contains <agnes:message> completion (JSON protocol)', async () => {
    process.env.AGNES_LAST_OUTPUT = `<agnes:message>${JSON.stringify({ type: 'completion', id: 'x', timestamp: new Date().toISOString(), status: 'DONE', summary: 'done' })}</agnes:message>`;
    const result = await promiseComplianceGate.run();
    expect(result.status).toBe('PASS');
  });

  test('passes when output contains <agnes:message> result (JSON protocol)', async () => {
    process.env.AGNES_LAST_OUTPUT = `<agnes:message>${JSON.stringify({ type: 'result', id: 'x', taskId: 't1', timestamp: new Date().toISOString(), status: 'DONE', content: 'ok' })}</agnes:message>`;
    const result = await promiseComplianceGate.run();
    expect(result.status).toBe('PASS');
  });

  test('fails when output contains neither promise tag nor agnes:message', async () => {
    process.env.AGNES_LAST_OUTPUT = 'just some text';
    const result = await promiseComplianceGate.run();
    expect(result.status).toBe('FAIL');
    expect(result.evidence.errors).toContain('Output does not contain a completion signal (<promise> or <agnes:message>)');
  });

  test('fails when AGNES_LAST_OUTPUT is empty', async () => {
    process.env.AGNES_LAST_OUTPUT = '';
    const result = await promiseComplianceGate.run();
    expect(result.status).toBe('FAIL');
  });
});

describe('planExistsGate approval precondition', () => {
  const originalCwd = process.cwd();
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-plan-gate-'));
    fs.mkdirSync(path.join(tempDir, '.agnes'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('fails when active plan is not approved', async () => {
    fs.writeFileSync(path.join(tempDir, '.agnes', 'index.json'), JSON.stringify({
      activePlanId: 'plan-001',
      plans: [{ id: 'plan-001', status: 'draft' }],
    }), 'utf8');

    const result = await planExistsGate.run();

    expect(result.status).toBe('FAIL');
    expect(result.evidence.errors).toContain('Active plan plan-001 is draft; expected approved');
  });

  test('passes when active plan is approved', async () => {
    fs.writeFileSync(path.join(tempDir, '.agnes', 'index.json'), JSON.stringify({
      activePlanId: 'plan-001',
      plans: [{ id: 'plan-001', status: 'approved' }],
    }), 'utf8');

    const result = await planExistsGate.run();

    expect(result.status).toBe('PASS');
  });
});

describe('registerGate', () => {
  test('adds a gate to the list', () => {
    const gates: Gate[] = [promiseComplianceGate];
    const updated = registerGate(gates, stateFileIntegrityGate);
    expect(updated).toHaveLength(2);
    expect(updated[1].id).toBe('state-file-integrity');
  });
});

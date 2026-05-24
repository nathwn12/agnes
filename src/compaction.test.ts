import { describe, expect, test } from 'bun:test';
import { buildExecutionContextBlock } from './bootstrap.js';
import {
  buildCompactionBlock,
  buildCompactionContext,
  evaluateCompactionPolicy,
  getCompactionState,
  rememberCompactionState,
} from './compaction.js';

describe('evaluateCompactionPolicy', () => {
  test('returns none below the soft limit', () => {
    const decision = evaluateCompactionPolicy({
      sessionID: 'session-none',
      promptText: 'x'.repeat(99 * 4),
      softLimit: 100,
      hardLimit: 120,
    });

    expect(decision.action).toBe('none');
    expect(decision.state.lastAction).toBe('none');
  });

  test('nudges at the soft limit', () => {
    const decision = evaluateCompactionPolicy({
      sessionID: 'session-nudge',
      promptText: 'x'.repeat(100 * 4),
      softLimit: 100,
      hardLimit: 120,
    });

    expect(decision.action).toBe('nudge');
    expect(decision.advisory).toContain('Compaction Advisory');
    expect(decision.advisory).toContain('soft limit');
  });

  test('alerts at the hard limit', () => {
    const decision = evaluateCompactionPolicy({
      sessionID: 'session-alert',
      promptText: 'x'.repeat(120 * 4),
      softLimit: 100,
      hardLimit: 120,
    });

    expect(decision.action).toBe('alert');
    expect(decision.advisory).toContain('Compaction Required');
    expect(decision.advisory).toContain('/compact');
  });

  test('compacts early when struggle signals and the context is bloated', () => {
    const decision = evaluateCompactionPolicy({
      sessionID: 'session-compact',
      promptText: 'x'.repeat(80 * 4),
      softLimit: 100,
      hardLimit: 120,
      discretionaryFloor: 75,
      struggle: {
        noProgressIterations: 3,
        repeatedErrors: {},
        shortIterations: 0,
        lastPromiseTag: null,
      },
    });

    expect(decision.action).toBe('compact');
    expect(decision.advisory).toContain('Compaction Recommended');
    expect(decision.advisory).toContain('stale or bloated');
  });

  test('stores the last evaluated state', () => {
    const decision = evaluateCompactionPolicy({
      sessionID: 'session-store',
      promptText: 'x'.repeat(100 * 4),
      softLimit: 100,
      hardLimit: 120,
    });

    rememberCompactionState('session-store', decision.state);

    expect(getCompactionState('session-store')).toEqual(decision.state);
    expect(buildCompactionBlock(decision.state)).toContain('last_action');
    expect(buildCompactionContext(decision.state)).toContain('Approximate prompt load');
    expect(
      buildExecutionContextBlock({
        attempt: 1,
        struggleDetected: false,
        lastPromiseTag: null,
        compaction: decision.state,
      }),
    ).toContain('last_action: nudge');
  });
});

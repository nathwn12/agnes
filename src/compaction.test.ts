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

import {
  buildResidueSummary,
  updateAttractors,
  extractResidue,
} from './compaction.js';
import type { Attractor, SymbolicResidue } from './compaction.js';

describe('updateAttractors', () => {
  test('creates new attractors from fragments', () => {
    const fragments = ['The AuthMiddleware handles token validation', 'TokenRequest uses Bearer tokens'];
    const result = updateAttractors([], fragments);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(a => a.label === 'AuthMiddleware')).toBe(true);
  });

  test('reinforces existing attractors and decays', () => {
    const existing: Attractor[] = [
      { id: 'AuthMiddleware', label: 'AuthMiddleware', strength: 0.8, lastReinforced: Date.now(), evidence: ['initial'] },
      { id: 'OldConcept', label: 'OldConcept', strength: 0.3, lastReinforced: Date.now() - 100000, evidence: ['stale'] },
    ];
    const fragments = ['The AuthMiddleware verifies tokens', 'AuthMiddleware rate limits'];
    const result = updateAttractors(existing, fragments, 0.5);

    const authMid = result.find(a => a.label === 'AuthMiddleware');
    const oldConcept = result.find(a => a.label === 'OldConcept');

    expect(authMid).toBeDefined();
    if (authMid) {
      expect(authMid.strength).toBeGreaterThan(0.5); // decayed from 0.8 → 0.4, then reinforced → ≥0.6
    }

    // OldConcept should be pruned (strength 0.3 * 0.5 = 0.15, pruned if ≤ 0.1)
    // 0.15 > 0.1 so it stays but is weak
    if (oldConcept) {
      expect(oldConcept.strength).toBeLessThan(0.2);
    }
  });

  test('prunes attractors below threshold', () => {
    const existing: Attractor[] = [
      { id: 'Strong', label: 'Strong', strength: 0.9, lastReinforced: Date.now(), evidence: [] },
      { id: 'Weak', label: 'Weak', strength: 0.05, lastReinforced: Date.now(), evidence: [] },
    ];
    const result = updateAttractors(existing, [], 1.0);
    expect(result.some(a => a.label === 'Strong')).toBe(true);
    expect(result.some(a => a.label === 'Weak')).toBe(false);
  });
});

describe('buildResidueSummary', () => {
  test('formats residue with attractors, decisions, blockers', () => {
    const residue: SymbolicResidue = {
      attractors: [
        { id: 'A', label: 'Auth', strength: 0.9, lastReinforced: Date.now(), evidence: [] },
      ],
      decisions: ['Use JWT'],
      blockers: ['Rate limiting not implemented'],
      activeContext: 'Working on auth module',
    };

    const summary = buildResidueSummary(residue);
    expect(summary).toContain('Auth');
    expect(summary).toContain('Use JWT');
    expect(summary).toContain('Rate limiting');
    expect(summary).toContain('auth module');
  });

  test('handles empty residue', () => {
    const summary = buildResidueSummary({ attractors: [], decisions: [], blockers: [], activeContext: '' });
    expect(summary).toBe('');
  });
});

describe('extractResidue', () => {
  test('extracts residue from messages with no existing attractors', () => {
    const messages = [
      { info: { role: 'user' }, parts: [{ type: 'text', text: 'The AuthModule should use JWT tokens. The RateLimiter needs config.' }] },
    ];
    const residue = extractResidue(messages, []);
    expect(residue.attractors.length).toBeGreaterThan(0);
    expect(residue.attractors.some(a => a.label === 'AuthModule')).toBe(true);
  });
});

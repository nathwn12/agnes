import { describe, expect, test } from 'bun:test';
import {
  parseAgnesMessage,
  serializeAgnesMessage,
  isValidAgnesMessage,
  buildResultMessage,
  buildTaskMessage,
} from './protocol.js';
import type { CompletionMessage, ResultMessage, AnyAgnesMessage } from './schema.js';

function validTimestamp(): string {
  return new Date().toISOString();
}

function parseSerialized(text: string): Record<string, unknown> {
  expect(text.startsWith('\xA7AM')).toBe(true);
  return JSON.parse(text.slice(3)) as Record<string, unknown>;
}

describe('parseAgnesMessage (new compact format)', () => {
  test('parses compact §AM format', () => {
    const msg = '\xA7AM{"t":"completion","i":"abc","ts":"2026-01-01T00:00:00.000Z","s":"DONE","m":"all done"}';
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
    expect((result as CompletionMessage).status).toBe('DONE');
    expect((result as CompletionMessage).summary).toBe('all done');
  });

  test('parses compact result message', () => {
    const msg = '\xA7AM{"t":"result","i":"r1","ts":"2026-01-01T00:00:00.000Z","tid":"task-001","s":"DONE","c":"hello"}';
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('result');
    const r = result as ResultMessage;
    expect(r.taskId).toBe('task-001');
    expect(r.content).toBe('hello');
  });

  test('parses compact with nested artifact', () => {
    const msg = '\xA7AM{"t":"result","i":"r1","ts":"2026-01-01T00:00:00.000Z","tid":"t1","s":"DONE","c":"deep","a":{"l1":{"l2":{"l3":{"v":"deep"}}}}}';
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('result');
    const art = (result as ResultMessage).artifact as Record<string, Record<string, Record<string, Record<string, unknown>>>>;
    expect(art.l1.l2.l3.v).toBe('deep');
  });

  test('rejects invalid compact status', () => {
    const msg = '\xA7AM{"t":"completion","i":"abc","ts":"2026-01-01T00:00:00.000Z","s":"INVALID","m":"bad"}';
    expect(parseAgnesMessage(msg)).toBeNull();
  });

  test('rejects unknown type', () => {
    const msg = '\xA7AM{"t":"unknown","i":"abc","ts":"2026-01-01T00:00:00.000Z","s":"DONE","m":"test"}';
    expect(parseAgnesMessage(msg)).toBeNull();
  });
});

describe('parseAgnesMessage (backward compat with old format)', () => {
  test('parses old HTML-commented agnes:message tags', () => {
    const ts = validTimestamp();
    const msg = `<!-- <agnes:message>${JSON.stringify({
      type: 'completion',
      id: 'abc',
      timestamp: ts,
      status: 'DONE',
      summary: 'html round trip',
    })}</agnes:message> -->`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
    expect((result as CompletionMessage).summary).toBe('html round trip');
  });

  test('parses old simple agnes:message tags', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>${JSON.stringify({
      type: 'completion',
      id: 'abc',
      timestamp: ts,
      status: 'DONE',
      summary: 'all done',
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
    expect((result as CompletionMessage).status).toBe('DONE');
    expect((result as CompletionMessage).summary).toBe('all done');
  });

  test('parses old format task message', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>${JSON.stringify({
      type: 'task',
      id: 'abc',
      timestamp: ts,
      skill: 'general',
      payload: { file: 'src/a.ts' },
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('task');
  });

  test('parses old format result message', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>${JSON.stringify({
      type: 'result',
      id: 'r1',
      timestamp: ts,
      taskId: 'task-001',
      status: 'DONE',
      content: 'hello',
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('result');
    expect((result as ResultMessage).taskId).toBe('task-001');
  });

  test('rejects old format missing required field', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>${JSON.stringify({
      type: 'completion',
      id: 'abc',
      timestamp: ts,
      status: 'DONE',
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('rejects invalid status in old format', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>${JSON.stringify({
      type: 'result',
      id: 'r1',
      timestamp: ts,
      taskId: 'task-001',
      status: 'INVALID',
      content: 'test',
    })}</agnes:message>`;
    expect(parseAgnesMessage(msg)).toBeNull();
  });
});

describe('parseAgnesMessage (fallback JSON)', () => {
  test('parses JSON inside code fences', () => {
    const ts = validTimestamp();
    const msg = '```json\n{"type":"completion","id":"abc","timestamp":"' + ts + '","status":"DONE","summary":"done"}\n```';
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
  });

  test('returns null for empty string', () => {
    expect(parseAgnesMessage('')).toBeNull();
  });

  test('returns null for malformed JSON', () => {
    expect(parseAgnesMessage('{broken}')).toBeNull();
  });

  test('returns null for non-object', () => {
    expect(parseAgnesMessage('"string"')).toBeNull();
  });

  test('handles escaped quotes', () => {
    const ts = validTimestamp();
    const raw = `{"type":"completion","id":"abc","timestamp":"${ts}","status":"DONE","summary":"he\\"llo"}`;
    const msg = `<agnes:message>${raw}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect((result as CompletionMessage).summary).toBe('he\"llo');
  });

  test('handles braces inside string values', () => {
    const ts = validTimestamp();
    const raw = `{"type":"completion","id":"abc","timestamp":"${ts}","status":"DONE","summary":"{hello world}"}`;
    const msg = `<agnes:message>${raw}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect((result as CompletionMessage).summary).toBe('{hello world}');
  });
});

describe('buildResultMessage', () => {
  test('builds valid result message with reasoning', () => {
    const result = buildResultMessage({
      taskId: 'task-001',
      status: 'DONE',
      content: 'All good',
      reasoning: 'The agent concluded correctly',
    });
    expect(result.startsWith('\xA7AM')).toBe(true);
    const parsed = parseSerialized(result);
    expect(parsed.s).toBe('DONE');
    expect(parsed.rc).toBe('The agent concluded correctly');
    expect(parsed.tid).toBe('task-001');
    expect(parseAgnesMessage(result)).not.toBeNull();
  });

  test('builds valid result message without reasoning', () => {
    const result = buildResultMessage({
      taskId: 'task-001',
      status: 'BLOCKED',
      content: 'Blocked by dependency',
    });
    const parsed = parseSerialized(result);
    expect(parsed.s).toBe('BLOCKED');
    expect(parsed.tid).toBe('task-001');
    expect(parseAgnesMessage(result)).not.toBeNull();
  });
});

describe('buildTaskMessage', () => {
  test('builds valid task message with skill and payload', () => {
    const result = buildTaskMessage({
      skill: 'general',
      payload: { file: 'src/module.ts' },
      config: { tags: ['refactor'] },
    });
    expect(result.startsWith('\xA7AM')).toBe(true);
    const parsed = parseSerialized(result);
    expect(parsed.sk).toBe('general');
    expect(parsed.pl).toEqual({ file: 'src/module.ts' });
    expect(parsed.cfg).toEqual({ tags: ['refactor'] });
    expect(parseAgnesMessage(result)).not.toBeNull();
  });

  test('builds valid task message with defaults', () => {
    const result = buildTaskMessage({ skill: 'explorer', payload: { query: 'Find auth patterns' } });
    const parsed = parseSerialized(result);
    expect(parsed.sk).toBe('explorer');
    expect(parsed.pl).toEqual({ query: 'Find auth patterns' });
    expect(parseAgnesMessage(result)).not.toBeNull();
  });
});

describe('serializeAgnesMessage', () => {
  test('wraps JSON in compact §AM envelope', () => {
    const msg: CompletionMessage = {
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'done',
    };
    const result = serializeAgnesMessage(msg);
    expect(result.startsWith('\xA7AM')).toBe(true);
    expect(parseAgnesMessage(result)).not.toBeNull();
  });

  test('serializes completion message correctly', () => {
    const msg: CompletionMessage = {
      type: 'completion',
      id: 'abc',
      timestamp: '2025-01-01T00:00:00.000Z',
      status: 'DONE',
      summary: 'all tasks completed',
    };
    const result = serializeAgnesMessage(msg);
    expect(result).toContain('"t":"completion"');
    expect(result).toContain('"s":"DONE"');
    expect(result).toContain('"m":"all tasks completed"');
  });

  test('serializes result message correctly', () => {
    const msg: ResultMessage = {
      type: 'result',
      id: 'r1',
      timestamp: validTimestamp(),
      taskId: 'task-001',
      status: 'DONE',
      content: 'output content',
      artifact: { key: 'value' },
    };
    const result = serializeAgnesMessage(msg);
    expect(result).toContain('"t":"result"');
    expect(result).toContain('"tid":"task-001"');
    expect(result).toContain('"a"');
  });

  test('round-trips through parseAgnesMessage', () => {
    const msg: CompletionMessage = {
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'round trip test',
    };
    const serialized = serializeAgnesMessage(msg);
    const parsed = parseAgnesMessage(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('completion');
    expect((parsed as CompletionMessage).summary).toBe('round trip test');
  });

  test('serializes DONE_WITH_CONCERNS status', () => {
    const msg: CompletionMessage = {
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'DONE_WITH_CONCERNS',
      summary: 'mostly done',
    };
    const serialized = serializeAgnesMessage(msg);
    expect(serialized).toContain('DONE_WITH_CONCERNS');
    const parsed = parseAgnesMessage(serialized);
    expect(parsed).not.toBeNull();
    expect((parsed as CompletionMessage).status).toBe('DONE_WITH_CONCERNS');
  });

  test('auto-generates id when missing', () => {
    const result = serializeAgnesMessage({ type: 'completion', timestamp: validTimestamp(), status: 'DONE', summary: 'no id' });
    const parsed = parseSerialized(result);
    expect(parsed.i).toBeTruthy();
    expect(parsed.i).not.toBe('');
  });
});

describe('isValidAgnesMessage', () => {
  test('valid completion message passes', () => {
    const msg: AnyAgnesMessage = {
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'done',
    };
    expect(isValidAgnesMessage(msg)).toBe(true);
  });

  test('valid result message passes', () => {
    const msg: AnyAgnesMessage = {
      type: 'result',
      id: 'r1',
      timestamp: validTimestamp(),
      taskId: 't1',
      status: 'DONE',
      content: 'ok',
    };
    expect(isValidAgnesMessage(msg)).toBe(true);
  });

  test('valid task message passes', () => {
    const msg: AnyAgnesMessage = {
      type: 'task',
      id: 't1',
      timestamp: validTimestamp(),
      skill: 'general',
      payload: {},
    };
    expect(isValidAgnesMessage(msg)).toBe(true);
  });

  test('valid error message passes', () => {
    const msg: AnyAgnesMessage = {
      type: 'error',
      id: 'e1',
      timestamp: validTimestamp(),
      taskId: 't1',
      errorType: 'TimeoutError',
      detail: 'timed out',
    };
    expect(isValidAgnesMessage(msg)).toBe(true);
  });

  test('valid status message passes', () => {
    const msg: AnyAgnesMessage = {
      type: 'status',
      id: 's1',
      timestamp: validTimestamp(),
      taskId: 't1',
      phase: 'building',
    };
    expect(isValidAgnesMessage(msg)).toBe(true);
  });

  test('missing type field fails', () => {
    const msg = { id: 'abc', timestamp: validTimestamp(), status: 'DONE', summary: 'done' };
    expect(isValidAgnesMessage(msg)).toBe(false);
  });

  test('invalid type field fails', () => {
    const msg = { type: 'bad', id: 'abc', timestamp: validTimestamp(), status: 'DONE', summary: 'done' };
    expect(isValidAgnesMessage(msg)).toBe(false);
  });

  test('missing id field fails', () => {
    const msg = { type: 'completion', timestamp: validTimestamp(), status: 'DONE', summary: 'done' };
    expect(isValidAgnesMessage(msg)).toBe(false);
  });

  test('missing timestamp field fails', () => {
    const msg = { type: 'completion', id: 'abc', status: 'DONE', summary: 'done' };
    expect(isValidAgnesMessage(msg)).toBe(false);
  });

  test('null input fails', () => {
    expect(isValidAgnesMessage(null)).toBe(false);
  });

  test('non-object input fails', () => {
    expect(isValidAgnesMessage('string')).toBe(false);
  });

  test('wrong field types fail', () => {
    const msg = { type: 123 as unknown, id: 'abc', timestamp: validTimestamp() };
    expect(isValidAgnesMessage(msg)).toBe(false);
  });

  test('valid message with extra fields passes', () => {
    const msg = {
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'done',
      extraField: 'should be allowed',
    };
    expect(isValidAgnesMessage(msg)).toBe(true);
  });
});

describe('Completion status validation', () => {
  test('accepts all valid completion statuses', () => {
    const ts = validTimestamp();
    for (const status of ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED'] as const) {
      const msg = { type: 'completion', id: 'abc', timestamp: ts, status, summary: 'test' };
      expect(isValidAgnesMessage(msg)).toBe(true);
    }
  });

  test('rejects invalid completion status', () => {
    const ts = validTimestamp();
    const msg = { type: 'completion', id: 'abc', timestamp: ts, status: 'INVALID', summary: 'test' };
    expect(isValidAgnesMessage(msg)).toBe(false);
  });
});

describe('Format parity: compact vs old', () => {
  test('both formats accept all valid statuses identically', () => {
    const ts = validTimestamp();
    for (const status of ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED'] as const) {
      const compactMsg = `\xA7AM{"t":"result","i":"r1","ts":"${ts}","tid":"t1","s":"${status}","c":"test"}`;
      const oldMsg = `<agnes:message>${JSON.stringify({
        type: 'result', id: 'abc', timestamp: ts,
        taskId: 't1', status, content: 'test',
      })}</agnes:message>`;
      expect(parseAgnesMessage(compactMsg), `compact failed for ${status}`).not.toBeNull();
      expect(parseAgnesMessage(oldMsg), `old format failed for ${status}`).not.toBeNull();
    }
  });

  test('both formats reject invalid status identically', () => {
    const ts = validTimestamp();
    const compactMsg = `\xA7AM{"t":"result","i":"r1","ts":"${ts}","tid":"t1","s":"INVALID","c":"test"}`;
    const oldMsg = `<agnes:message>${JSON.stringify({
      type: 'result', id: 'abc', timestamp: ts,
      taskId: 't1', status: 'INVALID', content: 'test',
    })}</agnes:message>`;
    expect(parseAgnesMessage(compactMsg)).toBeNull();
    expect(parseAgnesMessage(oldMsg)).toBeNull();
  });
});

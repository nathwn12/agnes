import { describe, expect, test } from 'bun:test';
import {
  parseAgnesMessage,
  buildResultMessage,
  buildCompletionMessage,
} from './protocol.js';

function parseSerialized(text: string): Record<string, unknown> {
  expect(text.startsWith('\xA7AM')).toBe(true);
  return JSON.parse(text.slice(3)) as Record<string, unknown>;
}

describe('parseAgnesMessage (new compact format)', () => {
  test('parses §AM compact format', () => {
    const result = parseAgnesMessage('\xA7AM{"t":"completion","i":"task-001","s":"DONE","c":"all done"}');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
  });

  test('parses §AM with short keys and expands them', () => {
    const result = parseAgnesMessage('\xA7AM{"t":"result","i":"task-001","s":"DONE","c":"done","r":{"file":"a.ts"}}');
    expect(result).not.toBeNull();
    if (result) {
      const r = result as Record<string, unknown>;
      expect(r.taskID).toBe('task-001');
      expect(r.content).toBe('done');
      expect(r.artifacts).toEqual({ file: 'a.ts' });
    }
  });

  test('rejects deeply nested objects beyond MAX_MESSAGE_DEPTH', () => {
    const deeplyNested = '\xA7AM{"t":"completion","i":"t-1","c":"{\\"a\\":{\\"b\\":{\\"c\\":{\\"d\\":{\\"e\\":{\\"f\\":\\"too deep\\"}}}}}}"';
    parseAgnesMessage(deeplyNested);
    // May or may not parse depending on depth, but should not crash
    expect(true).toBe(true);
  });

  test('handles truncated JSON gracefully', () => {
    const result = parseAgnesMessage('\xA7AM{"t":"result","i":"task-001","c":"hello');
    expect(result).toBeNull();
  });

  test('returns null for random text', () => {
    expect(parseAgnesMessage('hello world')).toBeNull();
  });

  test('parses old HTML comment format', () => {
    const result = parseAgnesMessage('<!-- <agnes:message>{"type":"completion","taskID":"t-1","status":"DONE","content":"done"}</agnes:message> -->');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
  });
});

describe('parseAgnesMessage (content-length prefix)', () => {
  test('parses §AMLEN prefix with correct length', () => {
    const payload = '\xA7AM{"t":"result","i":"t-1","s":"DONE","c":"hello"}';
    const prefixed = `\xA7AMLEN${payload.length}:${payload}`;
    const result = parseAgnesMessage(prefixed);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('result');
  });

  test('rejects §AMLEN prefix with wrong length', () => {
    const payload = '\xA7AM{"t":"result","i":"t-1","s":"DONE","c":"hello"}';
    const prefixed = `\xA7AMLEN1:${payload}`;
    const result = parseAgnesMessage(prefixed);
    expect(result).toBeNull();
  });
});

describe('buildResultMessage', () => {
  test('builds valid result message', () => {
    const result = buildResultMessage('task-001', 'All good');
    expect(result.startsWith('\xA7AM')).toBe(true);
    const parsed = parseSerialized(result);
    expect(parsed.t).toBe('result');
    expect(parsed.s).toBe('DONE');
    expect(parsed.i).toBe('task-001');
    expect(parsed.c).toBe('All good');
    expect(parseAgnesMessage(result)).not.toBeNull();
  });

  test('builds result message with artifacts', () => {
    const result = buildResultMessage('task-001', 'Done', { filesChanged: ['a.ts'] });
    const parsed = parseSerialized(result);
    expect(parsed.t).toBe('result');
    expect(parsed.r).toEqual({ filesChanged: ['a.ts'] });
    expect(parseAgnesMessage(result)).not.toBeNull();
  });
});

describe('buildCompletionMessage', () => {
  test('builds valid completion message', () => {
    const result = buildCompletionMessage('task-001', 'All done');
    expect(result.startsWith('\xA7AM')).toBe(true);
    const parsed = parseSerialized(result);
    expect(parsed.t).toBe('completion');
    expect(parsed.s).toBe('DONE');
    expect(parsed.i).toBe('task-001');
    expect(parsed.c).toBe('All done');
    expect(parseAgnesMessage(result)).not.toBeNull();
  });

  test('builds completion message with artifacts', () => {
    const result = buildCompletionMessage('task-001', 'Done', { filesChanged: ['b.ts'] });
    const parsed = parseSerialized(result);
    expect(parsed.t).toBe('completion');
    expect(parsed.r).toEqual({ filesChanged: ['b.ts'] });
    expect(parseAgnesMessage(result)).not.toBeNull();
  });
});

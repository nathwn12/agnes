import { describe, expect, test } from 'bun:test';
import {
  parseAgnesMessage,
  serializeAgnesMessage,
  isValidAgnesMessage,
  generateMessageId,
  buildResultMessage,
  buildTaskMessage,
} from './protocol.js';
import type { CompletionMessage, ResultMessage, AnyAgnesMessage } from './protocol.js';

function validTimestamp(): string {
  return new Date().toISOString();
}

describe('parseAgnesMessage (Zod strict path)', () => {
  test('valid task message with schema field passes', () => {
    const ts = validTimestamp();
    const id = generateMessageId();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'task',
      id,
      timestamp: ts,
      goal: 'Implement feature',
      files: ['src/a.ts'],
      constraints: { no_shared_edits: true, read_only: false },
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('task');
  });

  test('valid result message with reasoning_content passes', () => {
    const ts = validTimestamp();
    const id = generateMessageId();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'result',
      id,
      timestamp: ts,
      status: 'DONE',
      summary: 'Task completed successfully',
      artifact: { output: 'test' },
      reasoning_content: 'The agent analyzed the code and determined...',
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('result');
    if (result && result.type === 'result') {
      expect(result.artifact).toEqual({ output: 'test' });
    }
  });

  test('missing required field "goal" in task with schema field fails', () => {
    const ts = validTimestamp();
    const id = generateMessageId();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'task',
      id,
      timestamp: ts,
      files: [],
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('missing required field "status" in result with schema field fails', () => {
    const ts = validTimestamp();
    const id = generateMessageId();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'result',
      id,
      timestamp: ts,
      summary: 'incomplete',
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('legacy messages (no schema field) pass through without Zod validation', () => {
    const ts = validTimestamp();
    const id = generateMessageId();
    const msg = `<agnes:message>${JSON.stringify({
      type: 'task',
      id,
      timestamp: ts,
      skill: 'builder',
      payload: { action: 'test' },
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('task');
  });

  test('invalid JSON returns null', () => {
    expect(parseAgnesMessage('<agnes:message>{broken}</agnes:message>')).toBeNull();
  });

  test('invalid message type with schema field returns null', () => {
    const ts = validTimestamp();
    const id = generateMessageId();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'unknown_type',
      id,
      timestamp: ts,
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('invalid completion status with schema field returns null', () => {
    const ts = validTimestamp();
    const id = generateMessageId();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'result',
      id,
      timestamp: ts,
      status: 'INVALID_STATUS',
      summary: 'test',
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
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
    expect(result).toContain('<agnes:message>');
    expect(result).toContain('"status":"DONE"');
    expect(result).toContain('"reasoning_content":"The agent concluded correctly"');
    expect(result).toContain('"schema":"agnes/message-v1"');
  });

  test('builds valid result message without reasoning', () => {
    const result = buildResultMessage({
      taskId: 'task-001',
      status: 'BLOCKED',
      content: 'Blocked by dependency',
    });
    expect(result).toContain('"status":"BLOCKED"');
    expect(result).toContain('"taskId":"task-001"');
  });
});

describe('buildTaskMessage', () => {
  test('builds valid task message with skill and payload', () => {
    const result = buildTaskMessage({
      skill: 'builder',
      payload: { file: 'src/module.ts' },
      config: { tags: ['refactor'] },
    });
    expect(result).toContain('<agnes:message>');
    expect(result).toContain('"skill":"builder"');
    expect(result).toContain('"file":"src/module.ts"');
    expect(result).toContain('"schema":"agnes/message-v1"');
  });

  test('builds valid task message with defaults', () => {
    const result = buildTaskMessage({ skill: 'explorer', payload: { query: 'Find auth patterns' } });
    const parsed = JSON.parse(result.replace(/<\/?agnes:message>/g, ''));
    expect(parsed.skill).toBe('explorer');
    expect(parsed.payload).toEqual({ query: 'Find auth patterns' });
  });
});

describe('parseAgnesMessage', () => {
  test('parses valid completion JSON inside agnes:message tags', () => {
    const msg = `<agnes:message>{"type":"completion","id":"abc","timestamp":"${validTimestamp()}","status":"DONE","summary":"all done"}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
    expect((result as CompletionMessage).status).toBe('DONE');
    expect((result as CompletionMessage).summary).toBe('all done');
  });

  test('parses valid completion JSON with extra whitespace and newlines', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>
      {
        "type": "completion",
        "id": "abc",
        "timestamp": "${ts}",
        "status": "DONE",
        "summary": "done"
      }
    </agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
    expect((result as CompletionMessage).status).toBe('DONE');
  });

  test('parses valid result message JSON', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>{"type":"result","id":"r1","timestamp":"${ts}","taskId":"task-001","status":"DONE","content":"hello"}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('result');
    const r = result as ResultMessage;
    expect(r.taskId).toBe('task-001');
    expect(r.content).toBe('hello');
  });

  test('parses JSON nested inside code fences', () => {
    const ts = validTimestamp();
    const msg = '```json\n{"type":"completion","id":"abc","timestamp":"' + ts + '","status":"DONE","summary":"done"}\n```';
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
  });

  test('parses deeply nested braces in JSON content', () => {
    const ts = validTimestamp();
    const nested = {
      type: 'result',
      id: 'r1',
      timestamp: ts,
      taskId: 't1',
      status: 'DONE',
      content: 'deep',
      artifact: { level1: { level2: { level3: { value: 'deep' } } } },
    };
    const msg = `<agnes:message>${JSON.stringify(nested)}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('result');
    const r = result as ResultMessage;
    const art = r.artifact as Record<string, Record<string, Record<string, Record<string, unknown>>>>;
    expect(art.level1.level2.level3.value).toBe('deep');
  });

  test('returns null for missing required fields', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>{"type":"completion","id":"abc","timestamp":"${ts}","status":"DONE"}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('returns null for unknown type', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>{"type":"unknown","id":"abc","timestamp":"${ts}","status":"DONE","summary":"test"}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseAgnesMessage('')).toBeNull();
  });

  test('returns null for malformed JSON', () => {
    const msg = '<agnes:message>{broken json}</agnes:message>';
    expect(parseAgnesMessage(msg)).toBeNull();
  });

  test('parses first message when multiple agnes:message tags present', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>{"type":"completion","id":"a","timestamp":"${ts}","status":"DONE","summary":"first"}</agnes:message>
<agnes:message>{"type":"completion","id":"b","timestamp":"${ts}","status":"DONE","summary":"second"}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect((result as CompletionMessage).summary).toBe('first');
  });

  test('returns null when no JSON braces found', () => {
    expect(parseAgnesMessage('just text without braces')).toBeNull();
  });

  test('handles escaped quotes inside JSON strings', () => {
    const ts = validTimestamp();
    const raw = `{"type":"completion","id":"abc","timestamp":"${ts}","status":"DONE","summary":"he\\\"llo"}`;
    const msg = `<agnes:message>${raw}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect((result as CompletionMessage).summary).toBe('he\"llo');
  });

  test('returns null for invalid completion status', () => {
    const ts = validTimestamp();
    const msg = `<agnes:message>{"type":"completion","id":"abc","timestamp":"${ts}","status":"INVALID","summary":"bad"}</agnes:message>`;
    expect(parseAgnesMessage(msg)).toBeNull();
  });

  test('returns null for non-object parsed value', () => {
    expect(parseAgnesMessage('"string"')).toBeNull();
  });

  test('returns null when parsed value is null', () => {
    expect(parseAgnesMessage('null')).toBeNull();
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

describe('serializeAgnesMessage', () => {
  test('wraps JSON in agnes:message tags', () => {
    const msg: CompletionMessage = {
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'done',
    };
    const result = serializeAgnesMessage(msg);
    expect(result.startsWith('<agnes:message>')).toBe(true);
    expect(result.endsWith('</agnes:message>')).toBe(true);
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
    expect(result).toContain('"type":"completion"');
    expect(result).toContain('"status":"DONE"');
    expect(result).toContain('"summary":"all tasks completed"');
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
    expect(result).toContain('"type":"result"');
    expect(result).toContain('"taskId":"task-001"');
    expect(result).toContain('"artifact"');
  });

  test('output can be round-tripped through parseAgnesMessage', () => {
    const id = generateMessageId();
    const msg: CompletionMessage = {
      type: 'completion',
      id,
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
    const id = generateMessageId();
    const msg: CompletionMessage = {
      type: 'completion',
      id,
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
      skill: 'builder',
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
    const msg = { type: 123, id: 'abc', timestamp: validTimestamp() };
    expect(isValidAgnesMessage(msg)).toBe(false);
  });

  test('valid message with additional unknown fields passes', () => {
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

describe('generateMessageId', () => {
  test('returns a UUID string', () => {
    const id = generateMessageId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('returns unique values on each call', () => {
    const id1 = generateMessageId();
    const id2 = generateMessageId();
    expect(id1).not.toBe(id2);
  });
});

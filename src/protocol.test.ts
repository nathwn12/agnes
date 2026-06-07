import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  parseAgnesMessage,
  serializeAgnesMessage,
  isValidAgnesMessage,
  buildResultMessage,
  buildTaskMessage,
} from './protocol.js';
import type { CompletionMessage, ResultMessage, AnyAgnesMessage } from './protocol.js';

function validTimestamp(): string {
  return new Date().toISOString();
}

function parseSerializedEnvelope(text: string): Record<string, unknown> {
  const match = text.match(/^<!--\s*<agnes:message>([\s\S]+)<\/agnes:message>\s*-->$/);
  expect(match).not.toBeNull();
  return JSON.parse(match![1]) as Record<string, unknown>;
}

describe('parseAgnesMessage (Zod strict path)', () => {
  test('valid task message with schema field passes', () => {
    const ts = validTimestamp();
    const id = randomUUID();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'task',
      id,
      timestamp: ts,
      skill: 'general',
      payload: { file: 'src/a.ts' },
      config: { tags: ['protocol'] },
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('task');
  });

  test('legacy task message-v1 shape with goal passes', () => {
    const ts = validTimestamp();
    const id = randomUUID();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'task',
      id,
      timestamp: ts,
      goal: 'Inspect runtime guardrails',
      files: ['src/plugin.ts'],
      constraints: { no_shared_edits: true, read_only: false },
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('task');
  });

  test('valid result message with reasoning_content passes', () => {
    const ts = validTimestamp();
    const id = randomUUID();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'result',
      id,
      timestamp: ts,
      taskId: 'task-001',
      status: 'DONE',
      content: 'Task completed successfully',
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

  test('result message-v1 shape with summary and taskId passes', () => {
    const ts = validTimestamp();
    const id = randomUUID();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'result',
      id,
      timestamp: ts,
      taskId: 'task-001',
      status: 'DONE',
      summary: 'Task completed successfully',
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('result');
  });

  test('missing required field "skill" in task with schema field fails', () => {
    const ts = validTimestamp();
    const id = randomUUID();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'task',
      id,
      timestamp: ts,
      payload: {},
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('missing required field "status" in result with schema field fails', () => {
    const ts = validTimestamp();
    const id = randomUUID();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'result',
      id,
      timestamp: ts,
      taskId: 'task-001',
      content: 'incomplete',
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('legacy messages (no schema field) pass through without Zod validation', () => {
    const ts = validTimestamp();
    const id = randomUUID();
    const msg = `<agnes:message>${JSON.stringify({
      type: 'task',
      id,
      timestamp: ts,
      skill: 'general',
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
    const id = randomUUID();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'task',
      id,
      timestamp: ts,
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('invalid completion status with schema field returns null', () => {
    const ts = validTimestamp();
    const id = randomUUID();
    const msg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'result',
      id,
      timestamp: ts,
      status: 'INVALID_STATUS',
      taskId: 'task-001',
      content: 'test',
    })}</agnes:message>`;
    const result = parseAgnesMessage(msg);
    expect(result).toBeNull();
  });

  test('valid completion message with schema field passes', () => {
    const result = parseAgnesMessage(`<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'completion',
      id: randomUUID(),
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'complete',
    })}</agnes:message>`);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
  });

  test('completion message with schema field missing summary fails', () => {
    const result = parseAgnesMessage(`<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'completion',
      id: randomUUID(),
      timestamp: validTimestamp(),
      status: 'DONE',
    })}</agnes:message>`);

    expect(result).toBeNull();
  });

  test('completion message with schema field invalid status fails', () => {
    const result = parseAgnesMessage(`<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'completion',
      id: randomUUID(),
      timestamp: validTimestamp(),
      status: 'INVALID_STATUS',
      summary: 'bad',
    })}</agnes:message>`);

    expect(result).toBeNull();
  });

  test('status message with schema field missing phase fails', () => {
    const result = parseAgnesMessage(`<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'status',
      id: randomUUID(),
      timestamp: validTimestamp(),
      taskId: 'task-001',
    })}</agnes:message>`);

    expect(result).toBeNull();
  });

  test('error message with schema field missing detail fails', () => {
    const result = parseAgnesMessage(`<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'error',
      id: randomUUID(),
      timestamp: validTimestamp(),
      taskId: 'task-001',
      errorType: 'BuildError',
    })}</agnes:message>`);

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
    expect(result.startsWith('<!-- <agnes:message>')).toBe(true);
    expect(result.endsWith('</agnes:message> -->')).toBe(true);
    expect(result).toContain('"status":"DONE"');
    expect(result).toContain('"reasoning_content":"The agent concluded correctly"');
    expect(result).toContain('"schema":"agnes/message-v1"');
    expect(parseAgnesMessage(result)).not.toBeNull();
  });

  test('builds valid result message without reasoning', () => {
    const result = buildResultMessage({
      taskId: 'task-001',
      status: 'BLOCKED',
      content: 'Blocked by dependency',
    });
    expect(result).toContain('"status":"BLOCKED"');
    expect(result).toContain('"taskId":"task-001"');
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
    expect(result.startsWith('<!-- <agnes:message>')).toBe(true);
    expect(result.endsWith('</agnes:message> -->')).toBe(true);
    expect(result).toContain('"skill":"general"');
    expect(result).toContain('"file":"src/module.ts"');
    expect(result).toContain('"schema":"agnes/message-v1"');
    expect(parseAgnesMessage(result)).not.toBeNull();
  });

  test('builds valid task message with defaults', () => {
    const result = buildTaskMessage({ skill: 'explorer', payload: { query: 'Find auth patterns' } });
    const parsed = parseSerializedEnvelope(result);
    expect(parsed.skill).toBe('explorer');
    expect(parsed.payload).toEqual({ query: 'Find auth patterns' });
    expect(parseAgnesMessage(result)).not.toBeNull();
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

  test('parses canonical HTML-commented agnes:message tags', () => {
    const msg = `<!-- <agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'completion',
      id: randomUUID(),
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'html round trip',
    })}</agnes:message> -->`;

    const result = parseAgnesMessage(msg);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('completion');
    expect((result as CompletionMessage).summary).toBe('html round trip');
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
  test('wraps JSON in canonical HTML-commented agnes:message envelope', () => {
    const msg: CompletionMessage = {
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'done',
    };
    const result = serializeAgnesMessage(msg);
    expect(result.startsWith('<!-- <agnes:message>')).toBe(true);
    expect(result.endsWith('</agnes:message> -->')).toBe(true);
    expect(parseSerializedEnvelope(result).schema).toBe('agnes/message-v1');
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
    const id = randomUUID();
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
    const id = randomUUID();
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

describe('validCompletionStatus (via isValidAgnesMessage)', () => {
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

describe('Zod strict path vs legacy path parity', () => {
  test('both paths accept all valid statuses identically', () => {
    const ts = validTimestamp();
    const uuid = randomUUID();
    for (const status of ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED'] as const) {
      const strictMsg = `<agnes:message>${JSON.stringify({
        schema: 'agnes/message-v1',
        type: 'result', id: uuid, timestamp: ts,
        taskId: 't1', status, content: 'test',
      })}</agnes:message>`;
      const legacyMsg = `<agnes:message>${JSON.stringify({
        type: 'result', id: 'abc', timestamp: ts,
        taskId: 't1', status, content: 'test',
      })}</agnes:message>`;
      expect(parseAgnesMessage(strictMsg), `strict path failed for ${status}`).not.toBeNull();
      expect(parseAgnesMessage(legacyMsg), `legacy path failed for ${status}`).not.toBeNull();
    }
  });

  test('both paths reject invalid status identically', () => {
    const ts = validTimestamp();
    const uuid = randomUUID();
    const strictMsg = `<agnes:message>${JSON.stringify({
      schema: 'agnes/message-v1',
      type: 'result', id: uuid, timestamp: ts,
      taskId: 't1', status: 'INVALID', content: 'test',
    })}</agnes:message>`;
    const legacyMsg = `<agnes:message>${JSON.stringify({
      type: 'result', id: 'abc', timestamp: ts,
      taskId: 't1', status: 'INVALID', content: 'test',
    })}</agnes:message>`;
    expect(parseAgnesMessage(strictMsg)).toBeNull();
    expect(parseAgnesMessage(legacyMsg)).toBeNull();
  });
});



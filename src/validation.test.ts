import { describe, expect, test } from 'bun:test';
import {
  validateMessage,
  escapeUserData,
  ValidationError,
  ALLOWED_MESSAGE_TYPES,
  ALLOWED_ERROR_TYPES,
} from './validation.js';
import type { AnyAgnesMessage } from './protocol.js';

function validTimestamp(): string {
  return new Date().toISOString();
}

describe('validateMessage', () => {
  test('valid completion message passes', () => {
    const msg = {
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'all done',
    };
    const result = validateMessage(msg);
    expect(result.type).toBe('completion');
    expect((result as AnyAgnesMessage).type).toBe('completion');
  });

  test('valid result message passes', () => {
    const msg = {
      type: 'result',
      id: 'r1',
      timestamp: validTimestamp(),
      taskId: 'task-001',
      status: 'DONE',
      content: 'output',
    };
    const result = validateMessage(msg);
    expect(result.type).toBe('result');
  });

  test('valid task message passes', () => {
    const msg = {
      type: 'task',
      id: 't1',
      timestamp: validTimestamp(),
      skill: 'builder',
      payload: { command: 'test' },
    };
    const result = validateMessage(msg);
    expect(result.type).toBe('task');
  });

  test('valid error message passes', () => {
    const msg = {
      type: 'error',
      id: 'e1',
      timestamp: validTimestamp(),
      taskId: 't1',
      errorType: 'TimeoutError',
      detail: 'timed out',
    };
    const result = validateMessage(msg);
    expect(result.type).toBe('error');
  });

  test('valid status message passes', () => {
    const msg = {
      type: 'status',
      id: 's1',
      timestamp: validTimestamp(),
      taskId: 't1',
      phase: 'building',
    };
    const result = validateMessage(msg);
    expect(result.type).toBe('status');
  });

  test('message with unknown fields passes (lenient)', () => {
    const msg = {
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'DONE',
      summary: 'done',
      extraField: 'should be allowed',
      anotherOne: 42,
    };
    expect(validateMessage(msg).type).toBe('completion');
  });

  test('throws ValidationError for null', () => {
    expect(() => validateMessage(null)).toThrow(ValidationError);
  });

  test('throws ValidationError for non-object', () => {
    expect(() => validateMessage('string')).toThrow(ValidationError);
  });

  test('throws ValidationError for missing type', () => {
    expect(() => validateMessage({ id: 'abc', timestamp: validTimestamp() })).toThrow(ValidationError);
  });

  test('throws ValidationError for unknown type', () => {
    expect(() => validateMessage({ type: 'bogus', id: 'abc', timestamp: validTimestamp() })).toThrow(ValidationError);
  });

  test('throws ValidationError for missing id', () => {
    expect(() => validateMessage({ type: 'completion', timestamp: validTimestamp(), status: 'DONE', summary: 'x' })).toThrow(ValidationError);
  });

  test('throws ValidationError for missing timestamp', () => {
    expect(() => validateMessage({ type: 'completion', id: 'abc', status: 'DONE', summary: 'x' })).toThrow(ValidationError);
  });

  test('throws ValidationError for non-string id', () => {
    expect(() => validateMessage({ type: 'completion', id: 123, timestamp: validTimestamp(), status: 'DONE', summary: 'x' })).toThrow(ValidationError);
  });

  test('throws ValidationError for invalid completion status', () => {
    expect(() => validateMessage({
      type: 'completion',
      id: 'abc',
      timestamp: validTimestamp(),
      status: 'INVALID',
      summary: 'x',
    })).toThrow(ValidationError);
  });

  test('throws ValidationError for result with missing taskId', () => {
    expect(() => validateMessage({
      type: 'result',
      id: 'r1',
      timestamp: validTimestamp(),
      status: 'DONE',
      content: 'x',
    })).toThrow(ValidationError);
  });
});

describe('escapeUserData', () => {
  test('strips protocol key prefix from strings at root level', () => {
    const input = { type: 'completion', id: 'abc' };
    const result = escapeUserData(input) as Record<string, unknown>;
    expect(result.__user_type).toBe('completion');
    expect(result.__user_id).toBe('abc');
    expect(result).not.toHaveProperty('type');
    expect(result).not.toHaveProperty('id');
  });

  test('passes through non-protocol keys unchanged', () => {
    const input = { name: 'test', value: 42 };
    const result = escapeUserData(input) as Record<string, unknown>;
    expect(result.name).toBe('test');
    expect(result.value).toBe(42);
  });

  test('handles nested objects', () => {
    const input = {
      user: { type: 'admin', name: 'bob' },
    };
    const result = escapeUserData(input) as Record<string, unknown>;
    const nested = result.user as Record<string, unknown>;
    expect(nested.__user_type).toBe('admin');
    expect(nested.name).toBe('bob');
  });

  test('handles arrays', () => {
    const input = {
      items: [
        { type: 'a', name: 'first' },
        { type: 'b', name: 'second' },
      ],
    };
    const result = escapeUserData(input) as { items: Array<Record<string, unknown>> };
    expect(result.items[0].__user_type).toBe('a');
    expect(result.items[1].__user_type).toBe('b');
    expect(result.items[0].name).toBe('first');
  });

  test('handles null values', () => {
    const input = { type: null, name: 'test' };
    const result = escapeUserData(input) as Record<string, unknown>;
    expect(result.__user_type).toBeNull();
  });

  test('handles undefined values', () => {
    const input: Record<string, unknown> = { type: undefined, name: 'test' };
    const result = escapeUserData(input) as Record<string, unknown>;
    expect(result.__user_type).toBeUndefined();
  });

  test('returns primitive values unchanged', () => {
    expect(escapeUserData('hello')).toBe('hello');
    expect(escapeUserData(42)).toBe(42);
    expect(escapeUserData(true)).toBe(true);
    expect(escapeUserData(null)).toBeNull();
    expect(escapeUserData(undefined)).toBeUndefined();
  });

  test('applies prefix to all protocol keys', () => {
    const allKeys = {
      type: 't',
      id: 'i',
      taskId: 'ti',
      timestamp: 'ts',
      status: 's',
      content: 'c',
      summary: 'sm',
      artifact: 'a',
      metrics: 'm',
      skill: 'sk',
      payload: 'p',
      config: 'cfg',
      phase: 'ph',
      progress: 'pr',
      errorType: 'et',
      detail: 'd',
      stack: 'st',
      reason: 'r',
    };
    const result = escapeUserData(allKeys) as Record<string, unknown>;
    for (const key of Object.keys(allKeys)) {
      expect(result[`__user_${key}`]).toBe(allKeys[key as keyof typeof allKeys]);
      expect(result).not.toHaveProperty(key);
    }
  });

  test('respects max depth truncation', () => {
    const deep = { a: { b: { c: { d: { type: 'buried' } } } } };
    const result = escapeUserData(deep, 0, 3) as Record<string, unknown>;
    const level3 = (result.a as Record<string, unknown>).b as Record<string, unknown>;
    const level4 = level3.c as Record<string, unknown>;
    expect(level4).toEqual({ d: { type: 'buried' } });
  });

  test('at depth 0 only processes the first level with maxDepth=1', () => {
    const input = { type: 'root', nested: { type: 'inner' } };
    const result = escapeUserData(input, 0, 1) as Record<string, unknown>;
    expect(result.__user_type).toBe('root');
    expect((result.nested as Record<string, unknown>).type).toBe('inner');
  });

  test('escapes __user_ prefix does not double-escape', () => {
    const input = { __user_type: 'already-escaped' };
    const result = escapeUserData(input) as Record<string, unknown>;
    expect(result.__user_type).toBe('already-escaped');
  });

  test('empty object returns empty object', () => {
    expect(escapeUserData({})).toEqual({});
  });

  test('empty array returns empty array', () => {
    expect(escapeUserData([])).toEqual([]);
  });
});

describe('ALLOWED_MESSAGE_TYPES', () => {
  test('contains all five message types', () => {
    expect(ALLOWED_MESSAGE_TYPES.has('task')).toBe(true);
    expect(ALLOWED_MESSAGE_TYPES.has('result')).toBe(true);
    expect(ALLOWED_MESSAGE_TYPES.has('error')).toBe(true);
    expect(ALLOWED_MESSAGE_TYPES.has('status')).toBe(true);
    expect(ALLOWED_MESSAGE_TYPES.has('completion')).toBe(true);
    expect(ALLOWED_MESSAGE_TYPES.size).toBe(5);
  });
});

describe('ALLOWED_ERROR_TYPES', () => {
  test('contains all defined error types', () => {
    const expected = [
      'TypeError', 'BuildError', 'TestFailure', 'LintError',
      'FileNotFound', 'PermissionDenied', 'NetworkError',
      'TimeoutError', 'ParseError', 'UnknownError',
    ];
    for (const t of expected) {
      expect(ALLOWED_ERROR_TYPES.has(t)).toBe(true);
    }
    expect(ALLOWED_ERROR_TYPES.size).toBe(10);
  });
});

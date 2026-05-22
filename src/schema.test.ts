import { describe, expect, test } from 'bun:test';
import { typeMatches, validatePayload, SKILL_REGISTRY } from './schema.js';
import type { SkillDescriptor } from './schema.js';

describe('typeMatches', () => {
  test('string type matches string value', () => {
    expect(typeMatches('hello', 'string')).toBe(true);
    expect(typeMatches(42, 'string')).toBe(false);
  });

  test('number type matches number value', () => {
    expect(typeMatches(42, 'number')).toBe(true);
    expect(typeMatches(3.14, 'number')).toBe(true);
    expect(typeMatches('42', 'number')).toBe(false);
  });

  test('integer type matches integer not float', () => {
    expect(typeMatches(42, 'integer')).toBe(true);
    expect(typeMatches(0, 'integer')).toBe(true);
    expect(typeMatches(-7, 'integer')).toBe(true);
    expect(typeMatches(3.14, 'integer')).toBe(false);
    expect(typeMatches('42', 'integer')).toBe(false);
  });

  test('boolean type matches boolean', () => {
    expect(typeMatches(true, 'boolean')).toBe(true);
    expect(typeMatches(false, 'boolean')).toBe(true);
    expect(typeMatches(0, 'boolean')).toBe(false);
    expect(typeMatches('true', 'boolean')).toBe(false);
  });

  test('object type matches plain object', () => {
    expect(typeMatches({ key: 'val' }, 'object')).toBe(true);
    expect(typeMatches(null, 'object')).toBe(false);
    expect(typeMatches([1, 2], 'object')).toBe(false);
    expect(typeMatches('str', 'object')).toBe(false);
  });

  test('array type matches array', () => {
    expect(typeMatches([1, 2, 3], 'array')).toBe(true);
    expect(typeMatches([], 'array')).toBe(true);
    expect(typeMatches({}, 'array')).toBe(false);
    expect(typeMatches(null, 'array')).toBe(false);
  });

  test('null type matches null', () => {
    expect(typeMatches(null, 'null')).toBe(true);
    expect(typeMatches(undefined, 'null')).toBe(false);
    expect(typeMatches(0, 'null')).toBe(false);
  });

  test('unknown type returns true (default case)', () => {
    expect(typeMatches('anything', 'unknown')).toBe(true);
    expect(typeMatches(42, 'whatever')).toBe(true);
    expect(typeMatches(null, 'custom_type')).toBe(true);
  });
});

describe('validatePayload', () => {
  test('valid payload with all required fields passes', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    };
    const result = validatePayload({ name: 'Alice', age: 30 }, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test('missing required field fails', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    };
    const result = validatePayload({ name: 'Alice' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/Missing required field: age/));
  });

  test('field with wrong type fails', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };
    const result = validatePayload({ name: 'Alice', age: 'thirty' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringMatching(/Type mismatch for "age": expected number, got string/),
    );
  });

  test('extra fields pass (lenient)', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };
    const result = validatePayload({ name: 'Alice', extra: 'should be ignored' }, schema);
    expect(result.valid).toBe(true);
  });

  test('empty required array passes', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: [],
    };
    const result = validatePayload({ name: 'Alice' }, schema);
    expect(result.valid).toBe(true);
  });

  test('no required or properties returns valid', () => {
    const result = validatePayload({ anything: 'goes' }, {});
    expect(result.valid).toBe(true);
  });

  test('null payload fails', () => {
    const schema = { type: 'object', required: ['name'] };
    const result = validatePayload(null, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/Payload must be a non-null object/));
  });

  test('array payload fails', () => {
    const schema = { type: 'object', required: ['name'] };
    const result = validatePayload([1, 2, 3], schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/Payload must be a non-null object/));
  });
});

describe('SKILL_REGISTRY', () => {
  test('is not empty after module load', () => {
    expect(SKILL_REGISTRY.size).toBeGreaterThan(0);
  });

  test('contains expected skill names', () => {
    const expected = [
      'ag-orchestrator',
      'ag-planner',
      'ag-builder',
      'ag-tdd',
      'ag-reviewer',
      'ag-verifier',
      'ag-debugger',
    ];
    for (const name of expected) {
      expect(SKILL_REGISTRY.has(name)).toBe(true);
    }
  });

  test('each entry has valid SkillDescriptor shape', () => {
    for (const [name, entry] of SKILL_REGISTRY) {
      expect(typeof name).toBe('string');
      expect(typeof (entry as SkillDescriptor).name).toBe('string');
      expect(typeof (entry as SkillDescriptor).description).toBe('string');
      expect(typeof (entry as SkillDescriptor).phase).toBe('string');
      expect(typeof (entry as SkillDescriptor).inputSchema).toBe('object');
      expect(typeof (entry as SkillDescriptor).outputSchema).toBe('object');
      expect(['content', 'content_and_artifact']).toContain(
        (entry as SkillDescriptor).responseFormat,
      );
    }
  });

  test('each entry with inputSchema has valid schema structure', () => {
    for (const [, entry] of SKILL_REGISTRY) {
      const schema = (entry as SkillDescriptor).inputSchema;
      if (Object.keys(schema).length > 0) {
        expect(schema).toHaveProperty('type');
      }
    }
  });
});

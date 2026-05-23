import { describe, expect, test } from 'bun:test';
import { isDeepSeekV4 } from './plugin.js';

describe('isDeepSeekV4', () => {
  test('deepseek/deepseek-v4-pro returns true', () => {
    expect(isDeepSeekV4('deepseek/deepseek-v4-pro')).toBe(true);
  });

  test('deepseek-v4-flash returns true', () => {
    expect(isDeepSeekV4('deepseek-v4-flash')).toBe(true);
  });

  test('ds4/local returns true', () => {
    expect(isDeepSeekV4('ds4/local')).toBe(true);
  });

  test('claude-sonnet-4 returns false', () => {
    expect(isDeepSeekV4('claude-sonnet-4')).toBe(false);
  });

  test('gpt-5.5 returns false', () => {
    expect(isDeepSeekV4('gpt-5.5')).toBe(false);
  });

  test('gemini-3.1 returns false', () => {
    expect(isDeepSeekV4('gemini-3.1')).toBe(false);
  });

  test('empty string returns false', () => {
    expect(isDeepSeekV4('')).toBe(false);
  });

  test('case insensitive matching for deepseek-v4', () => {
    expect(isDeepSeekV4('DEEPSEEK-V4-FLASH')).toBe(true);
  });
});

import { describe, expect, test } from 'bun:test';
import { getBootstrapContent } from './bootstrap.js';

describe('getBootstrapContent', () => {
  test('returns content including AGNES identity', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toContain('AGNES');
  });

  test('includes the Orchestrator Protocol header', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toMatch(/Orchestrator Protocol/);
  });

  test('includes delegation protocol', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toContain('agnes_delegate');
  });

  test('includes version in variable suffix', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toMatch(/v\d+\.\d+\.\d+/);
  });
});

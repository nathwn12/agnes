import { describe, expect, test } from 'bun:test';
import { getBootstrapContent } from './bootstrap.js';

describe('getBootstrapContent', () => {
  test('returns content including AGNES identity', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toContain('AGNES');
  });

  test('includes the version string', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toMatch(/AGNES v/);
  });

  test('includes delegation protocol', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toContain('agnes_delegate');
  });

  test('frontmatter is stripped from skill content', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    const lines = content!.split('\n');
    const frontMatterLines = lines.filter(l => l.trim() === '---');
    expect(frontMatterLines.length).toBe(0);
  });
});

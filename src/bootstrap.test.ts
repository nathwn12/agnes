import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { getBootstrapContent } from './bootstrap';

describe('getBootstrapContent', () => {
  test('returns content including the orchestrator skill instructions', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toContain('AGNES');
    expect(content!).toContain('orchestrator');
  });

  test('includes the version string from package.json', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toMatch(/Current AGNES version: `[^`]+`/);
  });

  test('includes plan state section with content', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toContain('<AGNES_PLAN_STATE>');
    const stateMatch = content!.match(/<AGNES_PLAN_STATE>\n([\s\S]*?)\n<\/AGNES_PLAN_STATE>/);
    expect(stateMatch).not.toBeNull();
    expect(stateMatch![1].length).toBeGreaterThan(5);
  });

  test('returns appropriate content even without a plan', () => {
    const originalCwd = process.cwd();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-bootstrap-'));
    try {
      process.chdir(tmp);
      const content = getBootstrapContent();
      expect(content).not.toBeNull();
      expect(content!).toContain('AGNES');
      expect(content!).toContain('<AGNES_PLAN_STATE>');
      expect(content!).toContain('No active plan');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('frontmatter is stripped from skill content', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    const lines = content!.split('\n');
    const frontMatterLines = lines.filter(l => l.trim() === '---');
    expect(frontMatterLines.length).toBe(0);
  });
});

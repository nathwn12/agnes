import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  readFrontmatter,
  getFileStatus,
  readStateFile,
  buildStateInjectionStrings,
  getStateSnapshot,
  listStateFiles,
} from './state.js';

function createTempWorkspace(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-'));
  fs.mkdirSync(path.join(tmp, 'docs', 'agnes'), { recursive: true });
  return tmp;
}

function writeStateFile(workspaceRoot: string, name: string, content: string): void {
  fs.writeFileSync(path.join(workspaceRoot, 'docs', 'agnes', name), content, 'utf8');
}

describe('readFrontmatter', () => {
  test('returns null for missing file', () => {
    const root = createTempWorkspace();
    expect(readFrontmatter(root, 'goal.md')).toBeNull();
  });

  test('returns empty object for file without frontmatter', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '# Goal\n\nSome content');
    expect(readFrontmatter(root, 'goal.md')).toEqual({});
  });

  test('parses frontmatter with status', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '---\nstatus: completed\n---\n# Goal\n\nDone');
    expect(readFrontmatter(root, 'goal.md')).toEqual({ status: 'completed' });
  });

  test('parses frontmatter with closing --- beyond 4096 bytes', () => {
    const root = createTempWorkspace();
    const padding = 'x'.repeat(5000);
    writeStateFile(root, 'goal.md', `---\nstatus: archived\npadding: ${padding}\n---\n# Goal\n\nContent`);
    expect(readFrontmatter(root, 'goal.md')?.status).toBe('archived');
  });

  test('parses frontmatter with multiple keys', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'handoff.md', '---\nstatus: template\nphase: review\n---\n# Handoff');
    const fm = readFrontmatter(root, 'handoff.md');
    expect(fm?.status).toBe('template');
    expect(fm?.phase).toBe('review');
  });
});

describe('getFileStatus', () => {
  test('returns absent for missing file', () => {
    const root = createTempWorkspace();
    expect(getFileStatus(root, 'nope.md')).toBe('absent');
  });

  test('returns active for file without frontmatter, non-template body', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', 'Just some content');
    expect(getFileStatus(root, 'goal.md')).toBe('active');
  });

  test('returns completed for status: completed', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '---\nstatus: completed\n---\nBody');
    expect(getFileStatus(root, 'goal.md')).toBe('completed');
  });

  test('returns archived for status: archived', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '---\nstatus: archived\n---\nBody');
    expect(getFileStatus(root, 'goal.md')).toBe('archived');
  });

  test('returns template for template body without frontmatter', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '# Goal\n\nA goal is a completion condition...');
    expect(getFileStatus(root, 'goal.md')).toBe('template');
  });

  test('returns template for template body with active frontmatter', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '---\nstatus: active\n---\n# Goal\n\nA goal is a completion condition...');
    expect(getFileStatus(root, 'goal.md')).toBe('template');
  });

  test('returns active for explicit status: active', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '---\nstatus: active\n---\nBody');
    expect(getFileStatus(root, 'goal.md')).toBe('active');
  });

  test('large frontmatter status is correctly classified', () => {
    const root = createTempWorkspace();
    const padding = 'x'.repeat(5000);
    writeStateFile(root, 'goal.md', `---\nstatus: completed\npadding: ${padding}\n---\nBody`);
    expect(getFileStatus(root, 'goal.md')).toBe('completed');
  });
});

describe('readStateFile', () => {
  test('returns null for missing file', () => {
    const root = createTempWorkspace();
    expect(readStateFile(root, 'none.md')).toBeNull();
  });

  test('returns full content', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'plan.md', '---\nstatus: active\n---\n# Plan\n\n- [ ] task');
    expect(readStateFile(root, 'plan.md')).toBe('---\nstatus: active\n---\n# Plan\n\n- [ ] task');
  });
});

describe('buildStateInjectionStrings', () => {
  test('returns directory-ready when no goal or handoff', () => {
    const root = createTempWorkspace();
    const result = buildStateInjectionStrings(root);
    expect(result).toContain('State directory ready');
  });

  test('returns goal block when goal exists and is active', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '---\nstatus: active\n---\nGoal: Test');
    const result = buildStateInjectionStrings(root);
    expect(result).toContain('Active goal');
    expect(result).toContain('Goal: Test');
  });

  test('returns handoff block when handoff exists and is active', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'handoff.md', '---\nstatus: active\n---\nGoal: Handoff test');
    const result = buildStateInjectionStrings(root);
    expect(result).toContain('Active handoff');
    expect(result).toContain('Goal: Handoff test');
  });

  test('does not include completed goal in state injection', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '---\nstatus: completed\n---\nGoal: Old task');
    const result = buildStateInjectionStrings(root);
    expect(result).toContain('State directory ready');
    expect(result).not.toContain('Active goal');
  });

  test('does not include frontmatter-wrapped template goal in state injection', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '---\nstatus: active\n---\n# Goal\n\nA goal is a completion condition...');
    const result = buildStateInjectionStrings(root);
    expect(result).toContain('State directory ready');
    expect(result).not.toContain('Active goal');
  });
});

describe('getStateSnapshot', () => {
  test('reads all files once', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '---\nstatus: active\n---\nGoal: Test');
    writeStateFile(root, 'plan.md', '---\nstatus: completed\n---\nPlan: Done');
    writeStateFile(root, 'handoff.md', '---\nstatus: archived\n---\nHandoff: Old');

    const snapshot = getStateSnapshot(root);
    expect(snapshot.goal?.frontmatter.status).toBe('active');
    expect(snapshot.plan?.status).toBe('completed');
    expect(snapshot.handoff?.status).toBe('archived');
    expect(snapshot.files).toContain('goal.md');
    expect(snapshot.files).toContain('plan.md');
    expect(snapshot.files).toContain('handoff.md');
  });

  test('returns null entries for missing files', () => {
    const root = createTempWorkspace();
    const snapshot = getStateSnapshot(root);
    expect(snapshot.goal).toBeNull();
    expect(snapshot.plan).toBeNull();
    expect(snapshot.handoff).toBeNull();
  });
});

describe('listStateFiles', () => {
  test('returns empty array for empty directory', () => {
    const root = createTempWorkspace();
    expect(listStateFiles(root)).toEqual([]);
  });

  test('only returns .md files', () => {
    const root = createTempWorkspace();
    writeStateFile(root, 'goal.md', '# Goal');
    writeStateFile(root, 'plan.md', '# Plan');
    fs.writeFileSync(path.join(root, 'docs', 'agnes', '.DS_Store'), '');
    const files = listStateFiles(root);
    expect(files).toContain('goal.md');
    expect(files).toContain('plan.md');
    expect(files).not.toContain('.DS_Store');
  });
});

import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { getBootstrapContent, buildRuntimeBlock, buildPlanStateBlock, buildShellBlock, buildExecutionContextBlock, buildBootstrap } from './bootstrap.js';
import type { PlanIndex } from './state.js';

describe('structured block builders', () => {
  const pkg = { version: '0.10.2', root: '/test/root', skillsDir: '/test/skills', cacheRoot: '/test/cache' };
  const shell = { name: 'powershell', version: '7.4', antiPatterns: ['Get-Content', 'Set-Content'], preferredSyntax: 'cmdlets' };
  const exec = { attempt: 2, struggleDetected: true, lastPromiseTag: 'DONE' };

  test('buildRuntimeBlock produces correct structured type tag', () => {
    const block = buildRuntimeBlock(pkg);
    expect(block).toContain('<structured type="runtime">');
    expect(block).toContain('</structured>');
  });

  test('buildRuntimeBlock contains expected fields', () => {
    const block = buildRuntimeBlock(pkg);
    expect(block).toContain('agnes_version:');
    expect(block).toContain('package_root:');
    expect(block).toContain('skills_dir:');
    expect(block).toContain('cache_root:');
  });

  test('buildPlanStateBlock says no active plan when index empty', () => {
    const emptyIndex: PlanIndex = {
      agnesVersion: '0.10.2',
      schemaVersion: 2,
      projectDir: fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-bs-')),
      projectName: 'test',
      updatedAt: new Date().toISOString(),
      activePlanId: null,
      plans: [],
    };
    const block = buildPlanStateBlock(emptyIndex);
    expect(block).toContain('No active plan');
  });

  test('buildPlanStateBlock includes planner provenance when provided', () => {
    const block = buildPlanStateBlock(null, { mode: 'builtin', route: 'builtin', reason: 'eligible lightweight boundary' });
    expect(block).toContain('planner_mode: builtin');
    expect(block).toContain('planner_route: builtin');
    expect(block).toContain('planner_reason: eligible lightweight boundary');
  });

  test('buildPlanStateBlock produces correct type tag', () => {
    const emptyIndex: PlanIndex = {
      agnesVersion: '0.10.2',
      schemaVersion: 2,
      projectDir: fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-bs-')),
      projectName: 'test',
      updatedAt: new Date().toISOString(),
      activePlanId: null,
      plans: [],
    };
    const block = buildPlanStateBlock(emptyIndex);
    expect(block).toContain('<structured type="plan_state">');
  });

  test('buildShellBlock includes anti_patterns list', () => {
    const block = buildShellBlock(shell);
    expect(block).toContain('anti_patterns:');
    expect(block).toContain('Get-Content');
    expect(block).toContain('Set-Content');
  });

  test('buildShellBlock produces correct type tag', () => {
    const block = buildShellBlock(shell);
    expect(block).toContain('<structured type="shell">');
  });

  test('buildExecutionContextBlock includes attempt info', () => {
    const block = buildExecutionContextBlock(exec);
    expect(block).toContain('attempt: 2');
    expect(block).toContain('struggle_detected: true');
    expect(block).toContain('last_promise_tag:');
    expect(block).toContain('DONE');
  });

  test('block output can be parsed back via YAML/structured tag regex', () => {
    const block = buildRuntimeBlock(pkg);
    const match = block.match(/<structured type="(\w+)">\n([\s\S]*?)\n<\/structured>/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('runtime');
    expect(match![2]).toContain('agnes_version:');
  });
});

describe('getBootstrapContent', () => {
  test('returns content including AGNES identity', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toContain('AGNES');
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

  test('includes planner provenance when provided', () => {
    const content = getBootstrapContent({ mode: 'builtin', route: 'builtin', reason: 'eligible lightweight boundary' });
    expect(content).not.toBeNull();
    expect(content!).toContain('Planner: route:builtin, mode:builtin, reason:eligible lightweight boundary');
  });

  test('includes the new simplified enforcement rules', () => {
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toContain('READ-ONLY tools (direct use):');
    expect(content!).toContain('MUTATION tools (delegate):');
    expect(content!).toContain('Complex multi-file research: delegate to @explore');
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

describe('buildBootstrap', () => {
  const pkg = { version: '0.10.2', root: '/test/root', skillsDir: '/test/skills', cacheRoot: '/test/cache' };
  const shell = { name: 'powershell', version: '7.4', antiPatterns: ['Get-Content'], preferredSyntax: 'cmdlets' };
  const exec = { attempt: 1, struggleDetected: false, lastPromiseTag: null };

  test('assembles structured blocks without orchestration layers', () => {
    const result = buildBootstrap({ pkg, index: null, shell, exec });
    const blockTypes = [...result.matchAll(/type="(\w+)"/g)].map(m => m[1]);
    expect(blockTypes.length).toBeGreaterThanOrEqual(3);
    expect(blockTypes[0]).toBe('runtime');
    expect(blockTypes).toContain('shell');
    expect(blockTypes).toContain('execution');
  });

  test('does not include removed blocks', () => {
    const result = buildBootstrap({ pkg, index: null, shell, exec });
    expect(result).not.toContain('orchestrator');
    expect(result).not.toContain('delegate_or_die');
    expect(result).not.toContain('named_roles');
    expect(result).not.toContain('tool_access');
    expect(result).not.toContain('protocol');
    expect(result).not.toContain('skill_registry');
  });

  test('includes plan_state block when index is provided', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-test-bb-'));
    try {
      const index: PlanIndex = {
        agnesVersion: '0.10.2',
        schemaVersion: 2,
        projectDir: tmp,
        projectName: 'test',
        updatedAt: new Date().toISOString(),
        activePlanId: null,
        plans: [],
      };
      const result = buildBootstrap({ pkg, index, shell, exec });
      expect(result).toContain('type="plan_state"');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('excludes plan_state block when no index and no planner', () => {
    const result = buildBootstrap({ pkg, index: null, shell, exec });
    expect(result).not.toContain('type="plan_state"');
  });
});

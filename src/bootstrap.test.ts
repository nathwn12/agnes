import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { getBootstrapContent, buildRuntimeBlock, buildOrchestratorBlock, buildNamedRolesBlock, buildToolAccessBlock, buildPlanStateBlock, buildShellBlock, buildProtocolBlock, buildExecutionContextBlock, buildSkillRegistryBlock, buildSkillRegistryText, buildBootstrap } from './bootstrap.js';
import type { OrchestratorRules } from './bootstrap.js';
import type { PlanIndex } from './state.js';

describe('structured block builders', () => {
  const pkg = { version: '0.10.2', root: '/test/root', skillsDir: '/test/skills', cacheRoot: '/test/cache' };
  const rules: OrchestratorRules = {
    delegate: true,
    parallelize: true,
    onePercent: true,
    verify: true,
    noSharedEdits: true,
    freshSubagents: true,
    scarcity: true,
    answerDirectly: true,
    namedRoles: {
      executor: 'Runs commands',
      explorer: 'Codebase research only',
      planner: 'Creates plans',
      builder: 'Implements tasks',
      reviewer: 'Reviews diffs',
    },
  };
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

  test('buildOrchestratorBlock produces correct type tag and rules', () => {
    const block = buildOrchestratorBlock(rules);
    expect(block).toContain('<structured type="orchestrator">');
    expect(block).toContain('delegate_or_die: true');
    expect(block).toContain('parallelize_by_default: true');
    expect(block).toContain('one_percent_rule: true');
    expect(block).toContain('verify_before_claiming: true');
    expect(block).toContain('no_shared_file_edits: true');
    expect(block).toContain('fresh_subagents_per_wave: true');
    expect(block).toContain('scarcity_principle: true');
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

  test('buildProtocolBlock includes marker_prefix and types array', () => {
    const block = buildProtocolBlock();
    expect(block).toContain('marker_prefix:');
    expect(block).toContain('agnes:message');
    expect(block).toContain('types:');
    expect(block).toContain('task');
    expect(block).toContain('result');
    expect(block).toContain('completion');
  });

  test('buildProtocolBlock produces correct type tag', () => {
    const block = buildProtocolBlock();
    expect(block).toContain('<structured type="protocol">');
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

  test('includes planner provenance when provided', () => {
    const content = getBootstrapContent({ mode: 'builtin', route: 'builtin', reason: 'eligible lightweight boundary' });
    expect(content).not.toBeNull();
    expect(content!).toContain('Planner: route:builtin, mode:builtin, reason:eligible lightweight boundary');
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

describe('buildSkillRegistryBlock', () => {
  test('produces correct structured type tag', () => {
    const block = buildSkillRegistryBlock();
    expect(block).toContain('<structured type="skill_registry">');
    expect(block).toContain('</structured>');
  });

  test('contains known skills (planner, tdd, builder, verifier, debugger)', () => {
    const block = buildSkillRegistryBlock();
    expect(block).toContain('planner');
    expect(block).toContain('tdd');
    expect(block).toContain('builder');
    expect(block).toContain('verifier');
    expect(block).toContain('debugger');
  });

  test('includes suggest_next with known downstream skills', () => {
    const block = buildSkillRegistryBlock();
    expect(block).toContain('multi-reviewer');
    expect(block).toContain('verifier');
  });

  test('yields valid YAML structure inside the tag', () => {
    const block = buildSkillRegistryBlock();
    const match = block.match(/<structured type="skill_registry">\n([\s\S]*?)\n<\/structured>/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('type: skill_registry');
    expect(match![1]).toContain('skills:');
  });
});

describe('buildToolAccessBlock', () => {
  test('produces correct structured type tag', () => {
    const block = buildToolAccessBlock();
    expect(block).toContain('<structured type="tool_access">');
    expect(block).toContain('</structured>');
  });

  test('partitions subagent-only tools', () => {
    const block = buildToolAccessBlock();
    expect(block).toContain('edit');
    expect(block).toContain('write');
    expect(block).toContain('glob');
    expect(block).toContain('grep');
    expect(block).toContain('bash');
  });

  test('lists main-context allowed tools', () => {
    const block = buildToolAccessBlock();
    expect(block).toContain('task');
    expect(block).toContain('skill');
  });

  test('includes shared tools (read, webfetch)', () => {
    const block = buildToolAccessBlock();
    expect(block).toContain('read');
    expect(block).toContain('webfetch');
  });

  test('yields valid YAML inside the tag', () => {
    const block = buildToolAccessBlock();
    const match = block.match(/<structured type="tool_access">\n([\s\S]*?)\n<\/structured>/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('type: tool_access');
    expect(match![1]).toContain('subagent_only');
    expect(match![1]).toContain('main_context_only');
  });
});

describe('buildNamedRolesBlock', () => {
  const rules: OrchestratorRules = {
    delegate: true,
    parallelize: true,
    onePercent: true,
    verify: true,
    noSharedEdits: true,
    freshSubagents: true,
    scarcity: true,
    answerDirectly: true,
    namedRoles: {
      executor: 'Runs commands',
      explorer: 'Codebase research only',
      planner: 'Creates plans',
      builder: 'Implements tasks',
      reviewer: 'Reviews diffs',
    },
  };

  test('produces correct structured type tag', () => {
    const block = buildNamedRolesBlock(rules);
    expect(block).toContain('<structured type="named_roles">');
    expect(block).toContain('</structured>');
  });

  test('includes all named roles', () => {
    const block = buildNamedRolesBlock(rules);
    expect(block).toContain('Runs commands');
    expect(block).toContain('Codebase research only');
    expect(block).toContain('Creates plans');
    expect(block).toContain('Implements tasks');
    expect(block).toContain('Reviews diffs');
  });

  test('includes answer_directly flag', () => {
    const block = buildNamedRolesBlock(rules);
    expect(block).toContain('answer_directly: true');
  });

  test('yields valid YAML structure inside the tag', () => {
    const block = buildNamedRolesBlock(rules);
    const match = block.match(/<structured type="named_roles">\n([\s\S]*?)\n<\/structured>/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('type: named_roles');
    expect(match![1]).toContain('roles:');
  });
});

describe('buildBootstrap', () => {
  const pkg = { version: '0.10.2', root: '/test/root', skillsDir: '/test/skills', cacheRoot: '/test/cache' };
  const rules: OrchestratorRules = {
    delegate: true,
    parallelize: true,
    onePercent: true,
    verify: true,
    noSharedEdits: true,
    freshSubagents: true,
    scarcity: true,
    answerDirectly: true,
    namedRoles: {
      executor: 'Runs commands',
      explorer: 'Codebase research only',
      planner: 'Creates plans',
      builder: 'Implements tasks',
      reviewer: 'Reviews diffs',
    },
  };
  const shell = { name: 'powershell', version: '7.4', antiPatterns: ['Get-Content'], preferredSyntax: 'cmdlets' };
  const exec = { attempt: 1, struggleDetected: false, lastPromiseTag: null };

  test('assembles all structured blocks in order', () => {
    const result = buildBootstrap({ pkg, rules, index: null, shell, exec });
    const blockTypes = [...result.matchAll(/type="(\w+)"/g)].map(m => m[1]);
    expect(blockTypes.length).toBeGreaterThanOrEqual(8);
    expect(blockTypes[0]).toBe('runtime');
    expect(blockTypes[1]).toBe('orchestrator');
    expect(blockTypes[2]).toBe('named_roles');
    expect(blockTypes[3]).toBe('tool_access');
    expect(blockTypes[4]).toBe('shell');
    expect(blockTypes[5]).toBe('execution');
    expect(blockTypes[6]).toBe('protocol');
  });

  test('includes delegator rules in the output', () => {
    const result = buildBootstrap({ pkg, rules, index: null, shell, exec });
    expect(result).toContain('delegate_or_die: true');
    expect(result).toContain('parallelize_by_default: true');
    expect(result).toContain('verify_before_claiming: true');
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
      const result = buildBootstrap({ pkg, rules, index, shell, exec });
      expect(result).toContain('type="plan_state"');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('excludes plan_state block when no index and no planner', () => {
    const result = buildBootstrap({ pkg, rules, index: null, shell, exec });
    expect(result).not.toContain('type="plan_state"');
  });
});

describe('buildSkillRegistryText', () => {
  test('returns markdown with skill names', () => {
    const text = buildSkillRegistryText();
    expect(text).toContain('planner');
    expect(text).toContain('tdd');
    expect(text).toContain('builder');
  });

  test('includes suggest_next arrows for skills with downstream suggestions', () => {
    const text = buildSkillRegistryText();
    expect(text).toContain('→ next:');
    expect(text).toContain('multi-reviewer');
  });

  test('does NOT contain structured tags', () => {
    const text = buildSkillRegistryText();
    expect(text).not.toContain('<structured');
    expect(text).not.toContain('</structured>');
  });

  test('starts with a skill registry header', () => {
    const text = buildSkillRegistryText();
    expect(text).toMatch(/^### Skill Registry/);
  });
});

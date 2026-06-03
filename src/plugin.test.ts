import { describe, expect, test } from 'bun:test';
import { buildBootstrap, getBootstrapPackageInfo } from './bootstrap.js';
import type { OrchestratorRules } from './bootstrap.js';
import { detectShell } from './shell.js';

describe('buildStructuredBootstrap (via buildBootstrap integration)', () => {
  const pkg = getBootstrapPackageInfo();
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
      executor: "Runs commands, tests, builds. Returns compact pass/fail + file refs. Never suggests fixes.",
      explorer: "Codebase research only. Glob -> grep -> selective read. Read-only. Never edits.",
      planner: "Creates/refreshes plan-NNN.yaml from task requirements using planner skill.",
      builder: "Implements one sub-task from plan. Delegates bash to executor and review to reviewer.",
      reviewer: "Reviews diff against sub-task scope using reviewer skill. Writes findings.",
    },
  };
  const shell = detectShell();
  const exec = { attempt: 1, struggleDetected: false, lastPromiseTag: null };

  test('produces combined output with all structured blocks', () => {
    const result = buildBootstrap({
      pkg,
      rules,
      index: null,
      shell: {
        name: shell.shellType,
        version: shell.shellType,
        antiPatterns: shell.antiPatterns,
        preferredSyntax: shell.preferredSyntax,
      },
      exec,
    });

    expect(result).toContain('runtime');
    expect(result).toContain('orchestrator');
    expect(result).toContain('named_roles');
    expect(result).toContain('tool_access');
    expect(result).toContain('shell');
    expect(result).toContain('execution');
    expect(result).toContain('protocol');
  });

  test('orchestrator block contains delegator rules', () => {
    const result = buildBootstrap({
      pkg, rules, index: null,
      shell: { name: 'test', version: '1.0', antiPatterns: [], preferredSyntax: 'cmdlets' },
      exec,
    });
    expect(result).toContain('delegate_or_die: true');
    expect(result).toContain('parallelize_by_default: true');
    expect(result).toContain('verify_before_claiming: true');
    expect(result).toContain('one_percent_rule: true');
    expect(result).toContain('no_shared_file_edits: true');
    expect(result).toContain('fresh_subagents_per_wave: true');
    expect(result).toContain('scarcity_principle: true');
  });

  test('tool_access block partitions tools by subagent vs main context', () => {
    const result = buildBootstrap({
      pkg, rules, index: null,
      shell: { name: 'test', version: '1.0', antiPatterns: [], preferredSyntax: 'cmdlets' },
      exec,
    });
    expect(result).toContain('type="tool_access"');
    expect(result).toContain('edit');
    expect(result).toContain('write');
    expect(result).toContain('glob');
    expect(result).toContain('grep');
    expect(result).toContain('bash');
    expect(result).toContain('task');
    expect(result).toContain('skill');
  });

  test('named roles includes all five standard roles', () => {
    const result = buildBootstrap({
      pkg, rules, index: null,
      shell: { name: 'test', version: '1.0', antiPatterns: [], preferredSyntax: 'cmdlets' },
      exec,
    });
    expect(result).toContain('executor');
    expect(result).toContain('explorer');
    expect(result).toContain('planner');
    expect(result).toContain('builder');
    expect(result).toContain('reviewer');
  });
});

describe('AgnesPlugin structure', () => {
  test('plugin factory returns an object with config and message hooks', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    expect(plugin).toHaveProperty('config');
    expect(plugin).toHaveProperty(['chat.message']);
    expect(plugin).toHaveProperty(['experimental.chat.messages.transform']);
    expect(typeof (plugin as any).config).toBe('function');
    expect(typeof (plugin as any)['chat.message']).toBe('function');
    expect(typeof (plugin as any)['experimental.chat.messages.transform']).toBe('function');
  });

  test('config hook sets planner mode from config', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const config: Record<string, unknown> = {
      planner: { mode: 'builtin' },
    };
    await plugin.config!(config);
    expect(config.planner).toBeDefined();
    expect((config.planner as Record<string, unknown>).mode).toBe('builtin');
  });

  test('config hook defaults planner mode to auto when not set', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const config: Record<string, unknown> = {};
    await plugin.config!(config);
    expect((config.planner as Record<string, unknown>).mode).toBe('auto');
  });

  test('config hooks adds skills path', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const config: Record<string, unknown> = {
      skills: { paths: [] },
    };
    await plugin.config!(config);
    const paths = (config.skills as Record<string, unknown>).paths as string[];
    expect(paths.length).toBeGreaterThan(0);
  });

  test('config hook sets provider interleaved config', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const config: Record<string, unknown> = {};
    await plugin.config!(config);
    const provider = config.provider as Record<string, unknown>;
    expect(provider).toBeDefined();
    expect(provider.interleaved).toEqual({ field: 'reasoning_content' });
  });
});

describe('chat.message hook', () => {
  test('captures model ID from input', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const input = { model: { modelID: 'gpt-4' } };
    await (plugin as any)['chat.message'](input);
  });
});

describe('experimental.chat.messages.transform hook', () => {
  test('skips when no messages', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { messages: [] };
    await (plugin as any)['experimental.chat.messages.transform']({}, output);
  });

  test('skips when bootstrap already present', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = {
      messages: [
        {
          info: { role: 'user' },
          parts: [{ type: 'text', text: 'EXTREMELY_IMPORTANT\nsome content' }],
        },
      ],
    };
    await (plugin as any)['experimental.chat.messages.transform']({}, output);
    expect(output.messages[0].parts).toHaveLength(1);
  });
});

describe('tool.definition hook', () => {
  test('modifies edit tool description with delegation warning', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Edit a file', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'edit' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
    expect(output.description).toContain('delegate_or_die');
    expect(output.description).toContain('Edit a file');
  });

  test('modifies write tool description with delegation warning', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Write a file', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'write' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
  });

  test('modifies glob tool description', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Search files', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'glob' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
    expect(output.description).toContain('explorer');
  });

  test('modifies grep tool description', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Grep files', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'grep' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
  });

  test('modifies bash tool description', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Run command', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'bash' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
    expect(output.description).toContain('executor');
  });

  test('does not modify unrelated tool descriptions', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Read a file', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'read' }, output);
    expect(output.description).not.toContain('AGNES ENFORCEMENT');
  });
});

describe('bootstrap delegation enforcement', () => {
  test('getBootstrapContent includes delegation enforcement rules', () => {
    const { getBootstrapContent } = require('./bootstrap.js');
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content).toContain('AGNES DELEGATION ENFORCEMENT');
    expect(content).toContain('HARD RULES');
    expect(content).toContain('NEVER call edit/write/glob/grep/bash');
    expect(content).toContain('ALWAYS use the `task` tool');
  });
});

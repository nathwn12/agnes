import { describe, expect, test } from 'bun:test';
import { buildBootstrap, getBootstrapContent, getBootstrapPackageInfo } from './bootstrap.js';
import { detectShell } from './shell.js';

describe('buildStructuredBootstrap (via buildBootstrap integration)', () => {
  const pkg = getBootstrapPackageInfo();
  const shell = detectShell();
  const exec = { attempt: 1, struggleDetected: false, lastPromiseTag: null };

  test('produces combined output with all structured blocks', () => {
    const result = buildBootstrap({
      pkg,
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
    expect(result).toContain('shell');
    expect(result).toContain('execution');
  });

  test('includes shell and execution blocks', () => {
    const result = buildBootstrap({
      pkg, index: null,
      shell: { name: 'test', version: '1.0', antiPatterns: [], preferredSyntax: 'cmdlets' },
      exec,
    });
    expect(result).toContain('shell');
    expect(result).toContain('execution');
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

  test('config hook preserves build agent configuration without mutation gates', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const config: Record<string, unknown> = {
      agent: {
        build: {
          description: 'custom build',
          permission: {
            read: 'allow',
            task: {
              legacy: 'allow',
            },
          },
        },
      },
    };
    await plugin.config!(config);
    const build = (config.agent as Record<string, any>).build;
    expect(build.description).toBe('custom build');
    expect(build.permission.write).toBeUndefined();
    expect(build.permission.apply_patch).toBeUndefined();
    expect(build.permission.read).toBe('allow');
    expect(build.permission.task['*']).toBeUndefined();
    expect(build.permission.task.legacy).toBe('allow');
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

  test('injects canonical completion protocol comments without nesting', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = {
      messages: [
        {
          info: { role: 'user' },
          parts: [{ type: 'text', text: 'simple task', sessionID: 'canonical-protocol-test' }],
        },
      ],
    };

    await (plugin as any)['experimental.chat.messages.transform']({}, output);

    const injected = output.messages[0].parts[0].text;
    expect(injected).toContain('## Completion Protocol');
    expect(injected).not.toContain('<!-- <!--');
    expect(injected).not.toContain('--> -->');
    expect(injected).toContain('<!-- <agnes:message>{"type":"completion"');
    expect(injected).toContain('</agnes:message> -->');
  });
});

describe('tool.definition hook', () => {
  test('marks edit tool as delegate-only', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Edit a file', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'edit' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
    expect(output.description).toContain('Delegate-only mutation tool');
  });

  test('marks write tool as delegate-only', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Write a file', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'write' }, output);
    expect(output.description).toContain('Delegate-only mutation tool');
  });

  test('modifies glob tool description', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Search files', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'glob' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
    expect(output.description).toContain('@explore');
  });

  test('modifies grep tool description', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Grep files', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'grep' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
    expect(output.description).toContain('Read-only tool');
  });

  test('marks bash tool as delegate-only', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Run command', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'bash' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
    expect(output.description).toContain('@general');
  });

  test('marks read tool as delegation-preferred', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Read a file', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'read' }, output);
    expect(output.description).toContain('AGNES ENFORCEMENT');
    expect(output.description).toContain('Read-only tool');
  });
});

describe('bootstrap delegation enforcement', () => {
  test('getBootstrapContent includes delegation enforcement rules', () => {
    
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content).toContain('AGNES ENFORCEMENT');
    expect(content).toContain('MUTATION tools (delegate): edit, write, bash, apply_patch');
    expect(content).toContain('READ-ONLY tools (direct use):');
    expect(content).toContain('Complex multi-step implementation: delegate to @general');
  });
});

import { describe, expect, test, beforeEach } from 'bun:test';
import { getBootstrapContent } from './bootstrap.js';

describe('AgnesPlugin structure', () => {
  test('plugin factory returns an object with config and message hooks', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    expect(plugin).toHaveProperty('config');
    expect(plugin).toHaveProperty(['experimental.chat.messages.transform']);
    expect(typeof (plugin as any).config).toBe('function');
    expect(typeof (plugin as any)['experimental.chat.messages.transform']).toBe('function');
  });

  test('config hook preserves unsupported planner config without injecting defaults', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const config: Record<string, unknown> = {
      planner: { mode: 'builtin' },
    };
    await plugin.config!(config);
    expect(config.planner).toBeDefined();
    expect((config.planner as Record<string, unknown>).mode).toBe('builtin');
  });

  test('config hook does not add unsupported planner config', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const config: Record<string, unknown> = {};
    await plugin.config!(config);
    expect(config.planner).toBeUndefined();
  });

  test('config hook registers commands', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const config: Record<string, unknown> = {};
    await plugin.config!(config);
    const commands = (config.command as Record<string, unknown>) ?? {};
    expect(Object.keys(commands).length).toBeGreaterThan(0);
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

describe('experimental.chat.messages.transform hook', () => {
  beforeEach(async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    await (plugin as any).event({ event: { type: 'session.deleted' } });
  });

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

  test('skips bootstrap injection for subagent-directed messages with agent part', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = {
      messages: [
        {
          info: { role: 'user' },
          parts: [
            { type: 'text', text: 'search for X', sessionID: 'agent-guard-test' },
            { type: 'agent', agent: 'explorer', session: 'test-session' },
          ],
        },
      ],
    };
    await (plugin as any)['experimental.chat.messages.transform']({}, output);
    const textParts = output.messages[0].parts.filter((p: any) => p.type === 'text');
    const hasBootstrap = textParts.some((p: any) => p.text && p.text.includes('EXTREMELY_IMPORTANT'));
    expect(hasBootstrap).toBe(false);
  });
});

describe('tool.definition hook', () => {
  test('tool.definition is a no-op (routing handled by bootstrap)', async () => {
    const { AgnesPlugin } = await import('./plugin.js');
    const plugin = await AgnesPlugin({ directory: process.cwd() });
    const output = { description: 'Edit a file', parameters: {} };
    await (plugin as any)['tool.definition']({ toolID: 'edit' }, output);
    expect(output.description).toBe('Edit a file');
  });

  test('bootstrap contains delegation and commands', async () => {
    const { getBootstrapContent } = await import('./bootstrap.js');
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content).toContain('@explore');
    expect(content).toContain('@general');
    expect(content).toContain('agnes_delegate');
  });
});

describe('bootstrap delegation enforcement', () => {
  test('getBootstrapContent includes delegation protocol', () => {
    
    const content = getBootstrapContent();
    expect(content).not.toBeNull();
    expect(content!).toContain('@explore');
    expect(content!).toContain('@general');
    expect(content!).toContain('agnes_delegate');
  });
});

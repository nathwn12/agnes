import { beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildAutoDelegationSystemPrompt,
  buildDelegationPrompt,
  clearAutoDelegationState,
  handleAutoDelegateAfter,
  handleAutoDelegateBefore,
  isImplementationTool,
  markAutoDelegateBypassSession,
  rewriteToolDescription,
} from './auto-delegate.js';

function makeMockClient() {
  const calls = {
    created: 0,
    prompted: 0,
    messages: 0,
  };

  return {
    calls,
    session: {
      messages: async () => {
        calls.messages++;
        return {
          data: [
            { info: { role: 'user' }, parts: [{ type: 'text', text: 'Add a dark mode toggle' }] },
            { info: { role: 'assistant' }, parts: [{ type: 'text', text: 'I will implement it' }] },
          ],
          error: null,
        };
      },
      create: async () => {
        calls.created++;
        return { data: { id: 'ses_auto_child' }, error: null };
      },
      prompt: async () => {
        calls.prompted++;
        return {
          data: {
            parts: [{ type: 'text', text: 'Changed src/theme.ts and ran tests.\n\n\xA7AM{"t":"completion","i":"task-000","s":"DONE","c":"done","a":{}}' }],
          },
          error: null,
        };
      },
    },
  };
}

describe('auto-delegation classification', () => {
  test('classifies direct edit tools as implementation', () => {
    expect(isImplementationTool('write')).toBe(true);
    expect(isImplementationTool('edit')).toBe(true);
    expect(isImplementationTool('apply_patch')).toBe(true);
  });

  test('allows read-only and verification bash commands', () => {
    expect(isImplementationTool('bash', { command: 'git status' })).toBe(false);
    expect(isImplementationTool('bash', { command: 'bun run typecheck' })).toBe(false);
  });

  test('classifies mutating bash commands as implementation', () => {
    expect(isImplementationTool('bash', { command: 'mkdir src/new-feature' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'sed -i s/a/b/g src/file.ts' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'git commit -m test' })).toBe(true);
  });

  test('classifies PowerShell mutating cmdlets as implementation', () => {
    expect(isImplementationTool('bash', { command: 'Set-Content -Path file.txt -Value "data"' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'New-Item -Path dir -ItemType Directory' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'Remove-Item -Recurse -Force .\\temp' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'Copy-Item src\\a.ts dst\\b.ts -Force' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'Move-Item old.ts new.ts' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'Out-File -FilePath log.txt -InputObject "done"' })).toBe(true);
  });

  test('classifies pwsh/powershell executor calls as implementation', () => {
    expect(isImplementationTool('bash', { command: 'pwsh -Command "New-Item -Path test -ItemType Directory"' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'powershell -Command "Remove-Item file.txt"' })).toBe(true);
  });

  test('allows read-only pwsh/powershell wrapper calls', () => {
    expect(isImplementationTool('bash', { command: 'pwsh -Command "Get-ChildItem -Path src"' })).toBe(false);
    expect(isImplementationTool('bash', { command: 'powershell -Command "Get-Content file.txt"' })).toBe(false);
    expect(isImplementationTool('bash', { command: 'pwsh -Command "Test-Path file.txt"' })).toBe(false);
    expect(isImplementationTool('bash', { command: 'pwsh -Command \'Select-String -Pattern "foo" src/*.ts\'' })).toBe(false);
  });

  test('allows plain pwsh/powershell -File invocations as mutating', () => {
    expect(isImplementationTool('bash', { command: 'pwsh -File script.ps1' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'powershell -F setup.ps1' })).toBe(true);
  });

  test('classifies compound pwsh pipe with mutating cmdlet as implementation', () => {
    expect(isImplementationTool('bash', { command: 'Get-ChildItem | Remove-Item -Force' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'Get-Content src.txt | Set-Content dst.txt' })).toBe(true);
  });

  test('allows PowerShell read-only cmdlets', () => {
    expect(isImplementationTool('bash', { command: 'Get-ChildItem -Path src' })).toBe(false);
    expect(isImplementationTool('bash', { command: 'Get-Content file.txt' })).toBe(false);
    expect(isImplementationTool('bash', { command: 'Select-String -Pattern "foo" src/*.ts' })).toBe(false);
    expect(isImplementationTool('bash', { command: 'Test-Path file.txt' })).toBe(false);
  });

  test('classifies find -delete and find -exec as implementation', () => {
    expect(isImplementationTool('bash', { command: 'find . -name "*.log" -delete' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'find /tmp -type f -exec rm {} \\;' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'find . -exec mv {} /dest/ \\;' })).toBe(true);
    expect(isImplementationTool('bash', { command: 'find . -depth -execdir rm {} \\;' })).toBe(true);
  });

  test('allows plain find without destructive flags', () => {
    expect(isImplementationTool('bash', { command: 'find . -name "*.ts"' })).toBe(false);
    expect(isImplementationTool('bash', { command: 'find /src -type f -name "*.js"' })).toBe(false);
  });
});

describe('auto-delegation prompts and descriptions', () => {
  test('system prompt explains enforcement', () => {
    const prompt = buildAutoDelegationSystemPrompt();
    expect(prompt).toContain('Auto-Delegation Enforcement');
    expect(prompt).toContain('agnes_delegate');
    expect(prompt).toContain('intercepted');
  });

  test('delegation prompt includes context and intercepted args', () => {
    const prompt = buildDelegationPrompt('write', { filePath: 'src/a.ts', content: 'x' }, 'User asked for A');
    expect(prompt).toContain('User asked for A');
    expect(prompt).toContain('src/a.ts');
    expect(prompt).toContain('actual workspace files');
  });

  test('tool descriptions are rewritten for implementation tools', () => {
    expect(rewriteToolDescription('edit', 'Edit a file')).toContain('AUTO-DELEGATION');
    expect(rewriteToolDescription('read', 'Read a file')).toBe('Read a file');
  });
});

describe('auto-delegation hooks', () => {
  beforeEach(() => {
    process.env.AGNES_SKIP_GATE = '1';
    clearAutoDelegationState();
  });

  test('delegates write call and rewrites original args to temp no-op', async () => {
    const client = makeMockClient();
    const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-auto-'));
    const output = { args: { filePath: 'src/theme.ts', content: 'export const theme = {};\n' } };

    await handleAutoDelegateBefore(client, worktreePath, {
      tool: 'write',
      sessionID: 'ses_parent',
      callID: 'call_write_1',
    }, output);

    expect(client.calls.created).toBe(1);
    expect(client.calls.prompted).toBe(1);
    expect(String(output.args.filePath)).toContain(path.join('.agnes', 'tmp'));
    expect(String(output.args.content)).toContain('auto-delegated');

    const toolOutput = { title: '', output: 'original write result', metadata: {} };
    await handleAutoDelegateAfter({
      tool: 'write',
      sessionID: 'ses_parent',
      callID: 'call_write_1',
      args: output.args,
    }, toolOutput);

    expect(toolOutput.title).toContain('AGNES delegated write');
    expect(toolOutput.output).toContain('Changed src/theme.ts');
    expect((toolOutput.metadata as Record<string, unknown>).agnesAutoDelegated).toBe(true);
  });

  test('bypasses marked delegated sessions', async () => {
    const client = makeMockClient();
    const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'agnes-auto-'));
    const output = { args: { filePath: 'src/theme.ts', content: 'x' } };
    markAutoDelegateBypassSession('ses_child');

    await handleAutoDelegateBefore(client, worktreePath, {
      tool: 'write',
      sessionID: 'ses_child',
      callID: 'call_write_2',
    }, output);

    expect(client.calls.created).toBe(0);
    expect(output.args.filePath).toBe('src/theme.ts');
  });
});

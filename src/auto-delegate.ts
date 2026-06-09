import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectModelTier, getAutoDelegateSemaphore, getMaxResultChars, truncateResult, extractText } from './runtime.js';
import { createPromiseComplianceGate, runGates } from './verification.js';

type MinimalClient = any;

type ToolBeforeInput = {
  tool: string;
  sessionID: string;
  callID: string;
};

type ToolAfterInput = ToolBeforeInput & {
  args: Record<string, unknown>;
};

type ToolOutput = {
  title: string;
  output: string;
  metadata: Record<string, unknown>;
};

type AutoDelegationState = {
  originalTool: string;
  originalArgs: Record<string, unknown>;
  childSessionID: string;
  result: string;
};

const interceptedCalls = new Map<string, AutoDelegationState>();
const bypassSessions = new Set<string>();
const activeSessions = new Set<string>();

const READONLY_BASH_PATTERNS = [
  /^\s*(pwd|ls|dir|cat|echo|printf|head|tail|type|which|whoami|env|date|wc|sort|uniq|jq|rg|tree|locate|find|fd|stat|du|df|ps|file|diff)(\s|$)/i,
  /^\s*(Get-ChildItem|Get-Content|Select-String|Get-Command|Get-Help|Test-Path|Get-Item|Get-ItemProperty|Get-Location|Get-Process|Get-Service|Get-Date|Write-Host|Write-Output|Get-Variable|Get-Alias|Get-Member|Get-History|Measure-Object|Group-Object|Sort-Object|Where-Object|Select-Object|ForEach-Object)\b/i,
  /^\s*git\s+(status|diff|log|show|branch|remote|rev-parse|merge-base|tag|describe|shortlog|whatchanged|bisect|stash\s+(list|show)|help|ls-files|ls-tree|count-objects)(\s|$)/i,
  /^\s*(bun|npm|pnpm|yarn)\s+(test|run\s+(lint|typecheck|test|bundle|build|check))(\s|$)/i,
];

const MUTATING_BASH_PATTERNS = [
  />|>>|<<|\|\s*(tee|xargs)\b/i,
  /\b(sed\s+-i|perl\s+-pi|python\b|node\b|bun\s+run\s+scripts\/|touch|mkdir|rm|mv|cp|chmod|chown)\b/i,
  /\b(npm\s+install|npm\s+i|pnpm\s+add|yarn\s+add|bun\s+add)\b/i,
  /^\s*git\s+(add|commit|checkout|switch|reset|clean|merge|rebase|push|pull|restore|mv|rm|cherry-pick|revert|stash(\s+(push|save|drop|pop|apply))?|submodule(\s+(add|update|init))?)(\s|$)/i,
  /\b(Set-Content|Add-Content|New-Item|Remove-Item|Copy-Item|Move-Item|Rename-Item|Out-File|Invoke-WebRequest|Invoke-RestMethod)\b/i,
  /^\s*find\s+.*\s+-(delete|exec(dir)?)\b/i,
];

export function markAutoDelegateBypassSession(sessionID: string): void {
  bypassSessions.add(sessionID);
}

export function clearAutoDelegationState(): void {
  interceptedCalls.clear();
  bypassSessions.clear();
  activeSessions.clear();
}

export function cleanupTmpFiles(worktreePath: string, maxAgeMs = 24 * 60 * 60 * 1000): number {
  const tmpDir = path.join(worktreePath, '.agnes', 'tmp');
  let deleted = 0;
  try {
    if (!fs.existsSync(tmpDir)) return 0;
    const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(tmpDir, entry.name);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.rmSync(filePath, { force: true });
          deleted++;
        }
      } catch { /* skip if stat fails */ }
    }
  } catch { /* silent */ }
  return deleted;
}

export function isImplementationTool(tool: string, args: Record<string, unknown> = {}): boolean {
  if (tool === 'write' || tool === 'edit' || tool === 'apply_patch') return true;
  if (tool !== 'bash') return false;

  const command = String(args.command ?? '').trim();
  if (!command) return false;
  // Check mutating patterns first — compound commands like "Get-ChildItem | Remove-Item"
  // match read-only at the start but ARE mutating. Mutating wins.
  if (MUTATING_BASH_PATTERNS.some(pattern => pattern.test(command))) return true;
  if (READONLY_BASH_PATTERNS.some(pattern => pattern.test(command))) return false;

  // For pwsh/powershell wrappers, classify by inner command
  const pwshMatch = command.match(/^\s*(pwsh|powershell)\s+-(Command|C)\s+/i);
  if (pwshMatch) {
    const inner = command.slice(pwshMatch[0].length).replace(/^["']/, '').replace(/["']$/, '');
    if (MUTATING_BASH_PATTERNS.some(pattern => pattern.test(inner))) return true;
    if (READONLY_BASH_PATTERNS.some(pattern => pattern.test(inner))) return false;
    return true;
  }
  const pwshFileMatch = command.match(/^\s*(pwsh|powershell)\s+-(File|F)\s+/i);
  if (pwshFileMatch) return true; // External script files are always potentially mutating

  return false;
}

export function buildAutoDelegationSystemPrompt(): string {
  return [
    '## AGNES Auto-Delegation Enforcement',
    'You are the orchestrator. Implementation belongs in subagent sessions.',
    'For implementation work, call agnes_delegate or agnes_orchestrate instead of write/edit/apply_patch/bash.',
    'Direct implementation tool calls are intercepted and rerouted to a general subagent. Delegated child sessions are allowed to edit normally.',
    'Use read-only tools for investigation and verification tools for checks. Synthesize subagent results for the user.',
  ].join('\n');
}

export function rewriteToolDescription(toolID: string, current: string): string {
  if (toolID === 'write' || toolID === 'edit' || toolID === 'apply_patch') {
    return `${current}\n\nAGNES AUTO-DELEGATION: Do not use this directly for implementation in the orchestrator session. Use agnes_delegate/agnes_orchestrate. If called directly, AGNES intercepts and reroutes the work to a subagent.`;
  }
  if (toolID === 'bash') {
    return `${current}\n\nAGNES AUTO-DELEGATION: Read-only and verification commands are allowed. Code-writing or workspace-mutating commands are intercepted and rerouted to a subagent.`;
  }
  return current;
}

export async function handleAutoDelegateBefore(
  client: MinimalClient,
  worktreePath: string,
  input: ToolBeforeInput,
  output: { args: Record<string, unknown> },
): Promise<void> {
  if (process.env.AGNES_AUTO_DELEGATE === '0') return;
  if (!client?.session) return;
  if (bypassSessions.has(input.sessionID)) return;
  if (activeSessions.has(input.sessionID)) return;
  if (!isImplementationTool(input.tool, output.args)) return;

  activeSessions.add(input.sessionID);
  try {
    const context = await fetchConversationContext(client, input.sessionID);
    const prompt = buildDelegationPrompt(input.tool, output.args, context);
    const result = await runAutoDelegatedTask(client, input.sessionID, prompt);
    interceptedCalls.set(input.callID, {
      originalTool: input.tool,
      originalArgs: { ...output.args },
      childSessionID: result.childSessionID,
      result: result.output,
    });
    try {
      await (client as any).tui?.showToast?.({
        body: { message: `AGNES delegated ${input.tool} to subagent ${result.childSessionID.slice(0, 8)}`, variant: 'info' },
      });
    } catch { /* TUI toast is non-critical */ }
    const noopArgs = makeNoopArgs(worktreePath, input.tool, input.callID, output.args);
    for (const key of Object.keys(output.args)) delete output.args[key];
    Object.assign(output.args, noopArgs);
  } catch (err) {
    interceptedCalls.set(input.callID, {
      originalTool: input.tool,
      originalArgs: { ...output.args },
      childSessionID: '',
      result: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
    });
    const noopArgs = makeNoopArgs(worktreePath, input.tool, input.callID, output.args);
    for (const key of Object.keys(output.args)) delete output.args[key];
    Object.assign(output.args, noopArgs);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`AGNES auto-delegation blocked direct ${input.tool} execution and delegation failed: ${msg}`);
  } finally {
    activeSessions.delete(input.sessionID);
  }
}

export async function handleAutoDelegateAfter(input: ToolAfterInput, output: ToolOutput): Promise<void> {
  const state = interceptedCalls.get(input.callID);
  if (!state) return;

  output.title = `AGNES delegated ${state.originalTool}`;
  output.output = [
    `Direct ${state.originalTool} execution was rerouted to subagent ${state.childSessionID}.`,
    '',
    state.result,
  ].join('\n');
  output.metadata = {
    ...output.metadata,
    agnesAutoDelegated: true,
    childSessionID: state.childSessionID,
    originalTool: state.originalTool,
  };
  interceptedCalls.delete(input.callID);
}

export function buildDelegationPrompt(
  tool: string,
  args: Record<string, unknown>,
  conversationContext: string,
): string {
  return [
    'You are an AGNES general subagent. The orchestrator attempted direct implementation; you must perform the real workspace edit instead.',
    '',
    'Rules:',
    '- Implement the user request in the actual workspace files, not in .agnes/tmp.',
    '- Preserve unrelated changes. Read files before editing when needed.',
    '- Keep the change minimal and verify when feasible.',
    '- End with a concise summary of changed files and verification performed.',
    '',
    '## Completion Protocol',
    'When done, place this marker at the very end of your response:',
    '§AM{"t":"result","i":"auto-task","s":"DONE","c":"<summary of what was done>"}',
    'Replace <summary of what was done> with a brief summary of what you implemented.',
    'Status DONE if everything works. Status BLOCKED if you cannot proceed.',
    '',
    'Recent conversation context:',
    conversationContext || '(no context available)',
    '',
    `Intercepted tool: ${tool}`,
    'Intercepted args:',
    truncateForPrompt(JSON.stringify(args, null, 2), 8000),
  ].join('\n');
}

function makeNoopArgs(
  worktreePath: string,
  tool: string,
  callID: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const tmpDir = path.join(worktreePath, '.agnes', 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  if (tool === 'write') {
    return {
      ...args,
      filePath: path.join(tmpDir, `${callID}.write.txt`),
      content: `AGNES auto-delegated original write call ${callID}.\n`,
    };
  }

  if (tool === 'edit') {
    const oldString = typeof args.oldString === 'string' ? args.oldString : 'AGNES_AUTO_DELEGATED';
    const filePath = path.join(tmpDir, `${callID}.edit.txt`);
    fs.writeFileSync(filePath, oldString, 'utf8');
    return {
      ...args,
      filePath,
      oldString,
      newString: typeof args.newString === 'string' ? args.newString : oldString,
    };
  }

  if (tool === 'apply_patch') {
    const filePath = path.join(tmpDir, `${callID}.patch.txt`);
    fs.writeFileSync(filePath, 'AGNES_AUTO_DELEGATED\n', 'utf8');
    return {
      ...args,
      patchText: [
        '*** Begin Patch',
        `*** Update File: ${filePath.replace(/\\/g, '/')}`,
        '@@',
        '-AGNES_AUTO_DELEGATED',
        '+AGNES_AUTO_DELEGATED_NOOP',
        '*** End Patch',
      ].join('\n'),
    };
  }

  if (tool === 'bash') {
    return { ...args, command: '# noop' };
  }

  return args;
}

async function runAutoDelegatedTask(
  client: MinimalClient,
  parentSessionID: string,
  prompt: string,
): Promise<{ childSessionID: string; output: string }> {
  const sem = getAutoDelegateSemaphore();
  await sem.acquire();
  try {
    const createResp = await client.session.create({
      body: {
        parentID: parentSessionID,
        title: 'AGNES auto-delegated implementation',
      },
    });
    if (createResp.error) {
      throw new Error(`Failed to create auto-delegation child session: ${JSON.stringify(createResp.error)}`);
    }

    const childSessionID = createResp.data.id;
    markAutoDelegateBypassSession(childSessionID);

    const promptResp = await client.session.prompt({
      path: { id: childSessionID },
      body: {
        agent: 'general',
        parts: [{ type: 'text', text: prompt }],
      },
    });
    if (promptResp.error) {
      throw new Error(`Auto-delegation prompt failed: ${JSON.stringify(promptResp.error)}`);
    }

    const output = extractText(promptResp.data);
    try {
      await runGates([createPromiseComplianceGate(output)]);
    } catch {
      // Non-blocking: gate failure is logged inside runGates, return output regardless
    }
    const truncated = truncateResult(output, getMaxResultChars(detectModelTier()));
    return { childSessionID, output: truncated };
  } finally {
    sem.release();
  }
}

async function fetchConversationContext(client: MinimalClient, sessionID: string): Promise<string> {
  const resp = await client.session.messages({
    path: { id: sessionID },
    query: { limit: 15 },
  });
  if (resp.error) return `(failed to fetch conversation context: ${JSON.stringify(resp.error)})`;

  const messages = Array.isArray(resp.data) ? resp.data : [];
  const lines: string[] = [];
  for (const message of messages) {
    const role = message?.info?.role ?? 'unknown';
    const text = extractText(message);
    if (!text.trim()) continue;
    lines.push(`### ${role}\n${truncateForPrompt(text, 2500)}`);
  }
  return truncateForPrompt(lines.join('\n\n'), 12000);
}

function truncateForPrompt(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[...truncated ${text.length - maxChars} chars]`;
}

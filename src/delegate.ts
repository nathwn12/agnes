import * as fs from 'node:fs';
import * as path from 'node:path';
import * as logger from './logger.js';
import { runGates, createPromiseComplianceGate } from './verification.js';

export type MinimalClient = any;

export interface DelegateParams {
  agent: string;
  description: string;
  prompt: string;
  sessionID: string;
  directory: string;
}

export interface SubagentResult {
  status: 'pending' | 'completed' | 'error' | 'not_found';
  output?: string;
  error?: string;
}

interface TaskRefInfo {
  sessionID: string;
  directory: string;
  agent: string;
  description: string;
}

function extractText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';
  const obj = response as Record<string, unknown>;
  if (obj.parts && Array.isArray(obj.parts)) {
    return obj.parts
      .filter((p): p is { type: string; text?: string } =>
        typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'text'
      )
      .map((p) => p.text ?? '')
      .join('\n');
  }
  if (typeof obj.text === 'string') return obj.text;
  return '';
}

async function createChildSession(
  client: MinimalClient,
  params: DelegateParams,
): Promise<string> {
  const createResp = await client.session.create({
    body: {
      parentID: params.sessionID,
      title: `AGNES: ${params.agent} — ${params.description}`,
    },
  });

  if (createResp.error) {
    throw new Error(`Failed to create child session: ${JSON.stringify(createResp.error)}`);
  }

  return createResp.data.id;
}

export async function delegateBlocking(
  client: MinimalClient,
  params: DelegateParams,
): Promise<string> {
  let childId: string;
  try {
    childId = await createChildSession(client, params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `ERROR: failed to create child session — ${msg}`;
  }

  const promptResp = await client.session.prompt({
    path: { id: childId },
    body: {
      agent: params.agent,
      parts: [{ type: 'text', text: params.prompt }],
    },
  });

  if (promptResp.error) {
    return `ERROR: delegation failed — ${JSON.stringify(promptResp.error)}`;
  }

  const output = extractText(promptResp.data);
  // Run gates for logging; never block the output
  const gates = [createPromiseComplianceGate(output)];
  await runGates(gates);
  return output;
}

export async function delegateAsync(
  client: MinimalClient,
  params: DelegateParams,
): Promise<string> {
  let childId: string;
  try {
    childId = await createChildSession(client, params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `ERROR: failed to create child session — ${msg}`;
  }

  const resp = await client.session.prompt({
    path: { id: childId },
    body: {
      agent: params.agent,
      parts: [{ type: 'text', text: params.prompt }],
      noReply: true,
    },
  });

  if (resp?.error) {
    return `ERROR: async delegation failed — ${JSON.stringify(resp.error)}`;
  }

  return childId;
}

export async function getSubagentResult(
  client: MinimalClient,
  sessionID: string,
  _directory: string,
): Promise<SubagentResult> {
  try {
    const sessionResp = await client.session.get({
      path: { id: sessionID },
    });

    if (sessionResp.error) {
      if (sessionResp.error.status === 404) {
        return { status: 'not_found', error: `Session ${sessionID} not found` };
      }
      return { status: 'error', error: JSON.stringify(sessionResp.error) };
    }

    const messagesResp = await client.session.messages({
      path: { id: sessionID },
      query: { limit: 5 },
    });

    if (messagesResp.error) {
      return { status: 'error', error: JSON.stringify(messagesResp.error) };
    }

    const messages = messagesResp.data;
    if (!messages || messages.length === 0) {
      return { status: 'pending' };
    }

    const assistantMessages = messages.filter((m: { info?: { role?: string } }) => m.info?.role === 'assistant');
    if (assistantMessages.length === 0) {
      return { status: 'pending' };
    }

    const lastMsg = assistantMessages[assistantMessages.length - 1];
    const output = extractText(lastMsg);

    // Non-blocking gate check — log failures, return output regardless
    const gates = [createPromiseComplianceGate(output)];
    await runGates(gates);

    return { status: 'completed', output };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('getSubagentResult threw', err);
    return { status: 'error', error: msg };
  }
}

// ── Persistent task ref store ────────────────────────────────────────────────

const TASK_REFS_FILE = 'task-refs.json';

let _taskRefsPersistDir: string | null = null;
let _taskRefs: Map<string, TaskRefInfo> = new Map();
let _taskRefsDirty = false;

function getTaskRefsPath(): string | null {
  return _taskRefsPersistDir
    ? path.join(_taskRefsPersistDir, '.agnes', TASK_REFS_FILE)
    : null;
}

function loadTaskRefsFromDisk(projectDir: string): Map<string, TaskRefInfo> {
  try {
    const filePath = path.join(projectDir, '.agnes', TASK_REFS_FILE);
    const raw = fs.readFileSync(filePath, 'utf8');
    const entries = JSON.parse(raw) as Record<string, TaskRefInfo>;
    return new Map(Object.entries(entries));
  } catch { return new Map(); }
}

function flushTaskRefs(): void {
  if (!_taskRefsDirty) return;
  _taskRefsDirty = false;
  const filePath = getTaskRefsPath();
  if (!filePath) return;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(Object.fromEntries(_taskRefs)), 'utf8');
  } catch (err) {
    logger.warn('Failed to persist task refs', err);
  }
}

export function initTaskRefStore(projectDir: string): void {
  _taskRefsPersistDir = projectDir;
  _taskRefs = loadTaskRefsFromDisk(projectDir);
  _taskRefsDirty = false;
}

export function recordTaskRef(taskRef: string, info: TaskRefInfo): void {
  _taskRefs.set(taskRef, info);
  _taskRefsDirty = true;
  flushTaskRefs();
}

export function lookupTaskRef(taskRef: string): TaskRefInfo | undefined {
  return _taskRefs.get(taskRef);
}

export function clearTaskRefs(): void {
  _taskRefs.clear();
  _taskRefsDirty = true;
  flushTaskRefs();
  const filePath = getTaskRefsPath();
  if (filePath) {
    try { fs.rmSync(filePath, { force: true }); } catch {}
  }
}

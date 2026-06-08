import * as fs from 'node:fs';
import * as path from 'node:path';
import * as logger from './logger.js';
import { markAutoDelegateBypassSession } from './auto-delegate.js';
import { runGates, createPromiseComplianceGate } from './verification.js';
import { detectModelTier, getMaxResultChars, truncateResult, getSemaphore } from './runtime.js';

const SUBAGENT_TIMEOUT_MS = 120_000; // 2 min per subagent
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 min orphan cleanup

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
  createdAt?: number;
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

  markAutoDelegateBypassSession(createResp.data.id);
  return createResp.data.id;
}

export async function delegateBlocking(
  client: MinimalClient,
  params: DelegateParams,
): Promise<string> {
  const sem = getSemaphore();
  await sem.acquire();
  try {
    let childId: string;
    try {
      childId = await createChildSession(client, params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `ERROR: failed to create child session — ${msg}`;
    }

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const promptResp = await client.session.prompt({
          path: { id: childId },
          body: {
            agent: params.agent,
            parts: [{ type: 'text', text: params.prompt }],
          },
        });

        if (promptResp.error) {
          if (attempt < maxAttempts) {
            await sleep(Math.pow(3, attempt - 1) * 1000);
            continue;
          }
          return `ERROR: delegation failed after ${maxAttempts} attempts — ${JSON.stringify(promptResp.error)}`;
        }

        const output = extractText(promptResp.data);
        const tier = detectModelTier();
        const maxChars = getMaxResultChars(tier);
        const truncated = truncateResult(output, maxChars);
        const gates = [createPromiseComplianceGate(truncated)];
        await runGates(gates);
        return truncated;
      } catch (err) {
        if (attempt < maxAttempts) {
          await sleep(Math.pow(3, attempt - 1) * 1000);
          continue;
        }
        const msg = err instanceof Error ? err.message : String(err);
        return `ERROR: delegation failed after ${maxAttempts} attempts — ${msg}`;
      }
    }
    return `ERROR: delegation failed after ${maxAttempts} attempts — exhausted all retries`;
  } finally {
    sem.release();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function delegateAsync(
  client: MinimalClient,
  params: DelegateParams,
): Promise<string> {
  const sem = getSemaphore();
  await sem.acquire();
  try {
    let childId: string;
    try {
      childId = await createChildSession(client, params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `ERROR: failed to create child session — ${msg}`;
    }

    // Fire prompt WITHOUT noReply so the model actually processes it.
    // Don't await — return the session ID immediately for polling.
    client.session.prompt({
      path: { id: childId },
      body: {
        agent: params.agent,
        parts: [{ type: 'text', text: params.prompt }],
      },
    }).catch((err: unknown) => {
      logger.error('Async subagent failed', err);
    });

    return childId;
  } finally {
    sem.release();
  }
}

export async function getSubagentResult(
  client: MinimalClient,
  sessionID: string,
  _directory: string,
): Promise<SubagentResult> {
  const refInfo = lookupTaskRef(sessionID);
  if (refInfo?.createdAt) {
    const elapsed = Date.now() - refInfo.createdAt;
    if (elapsed > SUBAGENT_TIMEOUT_MS) {
      return {
        status: 'error',
        error: `TIMEOUT — subagent running for ${Math.round(elapsed / 1000)}s without completion`,
      };
    }
  }

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
    const tier = detectModelTier();
    const maxChars = getMaxResultChars(tier);
    const truncated = truncateResult(output, maxChars);

    // Non-blocking gate check — log failures, return output regardless
    const gates = [createPromiseComplianceGate(truncated)];
    await runGates(gates);

    return { status: 'completed', output: truncated };
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
    for (const e of Object.values(entries)) {
      if (!e.createdAt) e.createdAt = 0;
    }
    return new Map(Object.entries(entries));
  } catch { return new Map(); }
}

let _flushTimer: ReturnType<typeof setTimeout> | null = null;

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

function debouncedFlush(): void {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushTaskRefs();
  }, 500);
}

export function initTaskRefStore(projectDir: string): void {
  _taskRefsPersistDir = projectDir;
  _taskRefs = loadTaskRefsFromDisk(projectDir);
  _taskRefsDirty = false;
}

export function recordTaskRef(taskRef: string, info: TaskRefInfo): void {
  cleanupOrphanedSessions();
  _taskRefs.set(taskRef, { ...info, createdAt: info.createdAt ?? Date.now() });
  _taskRefsDirty = true;
  debouncedFlush();
}

export function cleanupOrphanedSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, info] of _taskRefs) {
    if (info.createdAt && now - info.createdAt > SESSION_TTL_MS) {
      _taskRefs.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    _taskRefsDirty = true;
    debouncedFlush();
    logger.warn(`Cleaned up ${cleaned} orphaned subagent session(s)`);
  }
  return cleaned;
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

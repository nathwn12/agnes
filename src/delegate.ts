import * as fs from 'node:fs';
import * as path from 'node:path';
import * as logger from './logger.js';
import { markAutoDelegateBypassSession } from './auto-delegate.js';
import { runGates, createPromiseComplianceGate } from './verification.js';
import { detectModelTier, getMaxResultChars, truncateResult, getSemaphore, MAX_DELEGATE_DEPTH, pushError } from './runtime.js';

const SUBAGENT_TIMEOUT_MS = 120_000; // 2 min per subagent
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 min orphan cleanup
const HEARTBEAT_INTERVAL_MS = 15_000; // 15s between heartbeat polls
const STALE_HEARTBEAT_MS = 60_000; // 60s without heartbeat → stale
const _sessionDepth = new Map<string, number>();
const _heartbeatIntervals = new Map<string, ReturnType<typeof setInterval>>();

function getDepth(sessionID: string): number {
  return _sessionDepth.get(sessionID) ?? 0;
}

function setDepth(sessionID: string, depth: number): void {
  _sessionDepth.set(sessionID, depth);
}

export function resetDepthTracking(): void {
  _sessionDepth.clear();
}

export const DELEGATE_BLOCKED_TOOLS = new Set([
  'agnes_delegate',
  'agnes_orchestrate',
  'agnes_memory',
]);

export type MinimalClient = any;

export interface DelegateParams {
  agent: string;
  description: string;
  prompt: string;
  sessionID: string;
  directory: string;
  blockedTools?: Set<string>;
  delegateDepth?: number;
  priorContext?: string;
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
  lastHeartbeat?: number;
  status?: 'running' | 'completed' | 'failed' | 'stale' | 'session_lost';
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
  const parentDepth = getDepth(params.sessionID);
  const maxDepth = params.delegateDepth ?? MAX_DELEGATE_DEPTH;
  if (parentDepth >= maxDepth) {
    throw new Error(`MAX_DEPTH exceeded — delegation depth ${parentDepth} >= ${maxDepth}`);
  }

  const createResp = await client.session.create({
    body: {
      parentID: params.sessionID,
      title: `AGNES: ${params.agent} — ${params.description}`,
    },
  });

  if (createResp.error) {
    throw new Error(`Failed to create child session: ${JSON.stringify(createResp.error)}`);
  }

  const childId = createResp.data.id;
  setDepth(childId, parentDepth + 1);
  markAutoDelegateBypassSession(childId);
  return childId;
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

    const blockedTools = params.blockedTools ?? DELEGATE_BLOCKED_TOOLS;
    const blockedNote = blockedTools.size > 0
      ? `\n\n**Restricted tools:** ${[...blockedTools].join(', ')}`
      : '';
    const priorNote = params.priorContext
      ? `\n\n**Prior context from similar tasks:**\n${params.priorContext}`
      : '';
    const fullPrompt = params.prompt + blockedNote + priorNote;

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const promptResp = await client.session.prompt({
          path: { id: childId },
          body: {
            agent: params.agent,
            parts: [{ type: 'text', text: fullPrompt }],
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

function stopHeartbeat(sessionID: string): void {
  const interval = _heartbeatIntervals.get(sessionID);
  if (interval) {
    clearInterval(interval);
    _heartbeatIntervals.delete(sessionID);
  }
}

function startHeartbeat(client: MinimalClient, sessionID: string): void {
  stopHeartbeat(sessionID);
  const interval = setInterval(async () => {
    try {
      const resp = await client.session.get({ path: { id: sessionID } });
      if (resp.error || !resp.data) {
        logger.warn(`Heartbeat: session ${sessionID} lost — ${JSON.stringify(resp.error)}`);
        const ref = _taskRefs.get(sessionID);
        if (ref) {
          ref.status = 'session_lost';
          ref.lastHeartbeat = Date.now();
          _taskRefsDirty = true;
          debouncedFlush();
        }
        stopHeartbeat(sessionID);
        return;
      }
      const ref = _taskRefs.get(sessionID);
      if (ref) {
        ref.lastHeartbeat = Date.now();
      }
    } catch (err) {
      logger.warn(`Heartbeat poll failed for ${sessionID}:`, err);
    }
  }, HEARTBEAT_INTERVAL_MS);
  _heartbeatIntervals.set(sessionID, interval);
  // Set initial heartbeat
  const ref = _taskRefs.get(sessionID);
  if (ref) {
    ref.lastHeartbeat = Date.now();
    ref.status = 'running';
  }
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

    const blockedTools = params.blockedTools ?? DELEGATE_BLOCKED_TOOLS;
    const blockedNote = blockedTools.size > 0
      ? `\n\n**Restricted tools:** ${[...blockedTools].join(', ')}`
      : '';
    const fullPrompt = params.prompt + blockedNote;

    const promptResp = await client.session.prompt({
      path: { id: childId },
      body: {
        agent: params.agent,
        parts: [{ type: 'text', text: fullPrompt }],
      },
    });

    if (promptResp.error) {
      pushError(childId, `delegateAsync prompt failed: ${JSON.stringify(promptResp.error)}`);
      return `ERROR: delegation prompt failed — ${JSON.stringify(promptResp.error)}`;
    }

    startHeartbeat(client, childId);
    return childId; // session ID for polling
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
      stopHeartbeat(sessionID);
      if (sessionResp.error.status === 404) {
        return { status: 'not_found', error: `Session ${sessionID} not found` };
      }
      pushError(sessionID, `session.get failed: ${JSON.stringify(sessionResp.error)}`);
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

    stopHeartbeat(sessionID);
    const ref = _taskRefs.get(sessionID);
    if (ref) {
      ref.status = 'completed';
      ref.lastHeartbeat = Date.now();
      _taskRefsDirty = true;
      debouncedFlush();
    }
    return { status: 'completed', output: truncated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    pushError(sessionID, `getSubagentResult threw: ${msg}`);
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
  const tmpPath = filePath + '.tmp';
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(Object.fromEntries(_taskRefs)), 'utf8');
    fs.rmSync(filePath, { force: true });
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    logger.warn('Failed to persist task refs', err);
    try { fs.rmSync(tmpPath, { force: true }); } catch {}
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
    const expired = info.createdAt && now - info.createdAt > SESSION_TTL_MS;
    const stale = info.lastHeartbeat && info.status === 'running' && now - info.lastHeartbeat > STALE_HEARTBEAT_MS;
    if (expired) {
      stopHeartbeat(key);
      _taskRefs.delete(key);
      cleaned++;
    } else if (stale) {
      stopHeartbeat(key);
      info.status = 'stale';
      info.lastHeartbeat = now;
      _taskRefsDirty = true;
      debouncedFlush();
      logger.warn(`Task ${key.slice(0, 8)} marked stale — no heartbeat for >60s`);
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

export function getRunningTaskCount(): number {
  let count = 0;
  for (const info of _taskRefs.values()) {
    if (info.status === 'running' || (!info.status && info.createdAt)) count++;
  }
  return count;
}

export function clearTaskRefs(): void {
  for (const key of _taskRefs.keys()) stopHeartbeat(key);
  _taskRefs.clear();
  const filePath = getTaskRefsPath();
  if (filePath) {
    try { fs.rmSync(filePath, { force: true }); } catch {}
  }
}

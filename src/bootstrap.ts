import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as logger from './logger.js';
import type { ProjectProfile } from './plugin-support.js';
import type { ModelTier } from './runtime.js';
import { getVersion, getIdentityLine, findPackageRoot } from './runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ORCHESTRATOR_MANDATE = `## AGNES Orchestrator Mandate
Your ONLY job: delegate, swarm, orchestrate, and fall back when delegation cannot proceed.
- User gives a goal → call agnes_orchestrate immediately. You MUST NOT implement directly. Auto-delegation intercepts write/edit/bash — let it work.
- Single known-task fix → use agnes_delegate with agent "general".
- If delegation fails (returns ERROR starting with "FALLBACK" or "ERROR"): implement that task directly with write/edit/bash. Auto-delegation will NOT intercept the fallback.
- After agnes_orchestrate completes: check for failed tasks and implement them directly.
- If agnes_memory/agnes_todo fail: fall back to direct tool equivalents. Never report ERROR to user — just do the work.
- Stop only for genuine blockers or vague requests. Otherwise execute autonomously — no permission pauses.`;

const packageRoot = findPackageRoot(path.resolve(__dirname, '..', '..')) ?? findPackageRoot(__dirname) ?? path.resolve(__dirname, '..', '..');

const COMMANDS_FULL = '/plan /build-fix /code-review /tdd /verify /checkpoint /learn /security /e2e /update-docs /refactor-clean /test-coverage /yolo /update-codemaps';
const COMMANDS_MEDIUM = '/plan /build-fix /code-review /tdd /verify /checkpoint /yolo /update-codemaps';
const MEDIUM_LINE = `Medium tier — tighter context, fewer parallel subagents, trimmed operational rules.
Delegate via agnes_delegate/agnes_get_result. Chunk exploration by folder. Never one big subagent.`;

// ── Stable tier cache ────────────────────────────────────────────────────────────

type StableCacheEntry = {
  content: string;
  key: string;
};

let _stableCache: StableCacheEntry | undefined;

export function getStableTier(version?: string): string | null {
  const ver = version ?? getVersion();
  const soulPath = path.join(packageRoot, 'SOUL.md');
  try {
    const stat = fs.statSync(soulPath);
    const cacheKey = `${ver}:${stat.size}:${stat.mtimeMs}`;
    if (_stableCache?.key === cacheKey) return _stableCache.content;

    const soulContent = fs.readFileSync(soulPath, 'utf8');
    const content = `${ORCHESTRATOR_MANDATE}

---

${soulContent}`;

    _stableCache = { content, key: cacheKey };
    return content;
  } catch (err) {
    logger.warn(`Failed to load SOUL.md from ${soulPath}`, err);
    return null;
  }
}

// ── Context tier ─────────────────────────────────────────────────────────────────

export function getContextTier(version?: string, project?: ProjectProfile, trimmed?: boolean): string | null {
  const ver = version ?? getVersion();

  if (trimmed) {
    return `${getIdentityLine()}
${MEDIUM_LINE}
Commands: ${COMMANDS_MEDIUM}`;
  }

  const projectLine = project
    ? `Project: ${project.projectName} (${project.languages.join(', ') || '?'}) pkg:${project.packageManager}`
    : '';

  const context = `v${ver} | ${projectLine}
Commands: ${COMMANDS_FULL}`;

  return context;
}

// ── Volatile tier ─────────────────────────────────────────────────────────────────

export function getVolatileTier(memoryBlock?: string, todoBlock?: string): string | null {
  const parts: string[] = [];
  if (memoryBlock) parts.push(memoryBlock);
  if (todoBlock) parts.push(todoBlock);
  return parts.length > 0 ? parts.join('\n\n') : null;
}

// ── Tier assembly (backward-compat entry) ────────────────────────────────────────

function buildMinimalBootstrap(version: string): string {
  return `AGNES v${version} — orchestrator plugin. Delegate work to subagents via agnes_delegate/agnes_get_result. Agents: general, explore. Chunk exploration by folder. Never one big subagent. 3 retries, 120s timeout.

${ORCHESTRATOR_MANDATE}`;
}

/** @deprecated Not called from production code — use getStableTier / getContextTier / getVolatileTier directly. */
export function getBootstrapContent(project?: ProjectProfile, tier?: ModelTier): string | null {
  const version = getVersion();
  const modelTier: ModelTier = tier ?? 'large';

  if (modelTier === 'small') {
    return buildMinimalBootstrap(version);
  }

  const parts: string[] = [];

  const stable = getStableTier(version);
  if (stable) parts.push(stable);

  if (modelTier === 'medium') {
    const context = getContextTier(version, undefined, true);
    if (context) parts.push(context);
  } else {
    const context = getContextTier(version, project, false);
    if (context) parts.push(context);
    const volatile = getVolatileTier();
    if (volatile) parts.push(volatile);
  }

  return parts.join('\n\n---\n\n');
}



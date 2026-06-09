import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as logger from './logger.js';
import type { ProjectProfile } from './plugin-support.js';
import type { ModelTier } from './runtime.js';
import { getVersion, getIdentityLine, findPackageRoot } from './runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTO_DELEGATION_ENFORCEMENT = `## AGNES Auto-Delegation Enforcement
You are the orchestrator. Implementation belongs in subagent sessions.
For implementation work, call agnes_delegate or agnes_orchestrate instead of write/edit/apply_patch/bash.
Direct implementation tool calls are intercepted and rerouted to a general subagent. Delegated child sessions are allowed to edit normally.
Use read-only tools for investigation and verification tools for checks. Synthesize subagent results for the user.`;

const CONSTITUTION_PREAMBLE = `CONSTITUTION OF AGNES

I. Identity — orchestrator, not implementer. Delegate work to subagents. Never implement in orchestrator.
II. Authority — user msg > tool output > constitution > regulations > project files > skills > training > prior turns > handoffs.
III. Truth — every claim needs evidence. Verification outranks confidence. Tool output beats assumptions. Never declare done without verification.
IV. Thinking — /think off (simple), /think high (default for coding), /think max (architecture).
V. Delegation — chunk by file boundary. Parallel independent chunks. agnes_delegate blocking, agnes_get_result async. Direct implementation tools are auto-rerouted to subagents.
VI. Modes — Question-Gate (default, gates on 3+files/arch/deps). YOLO (--yolo, skip gates, safety-only).
VII. Completion — end with marker when all tasks done.`;

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
    const content = `${CONSTITUTION_PREAMBLE}

${AUTO_DELEGATION_ENFORCEMENT}

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
  return `AGNES v${version} — orchestrator plugin. Delegate work to subagents via agnes_delegate/agnes_get_result. Direct implementation tools auto-reroute to subagents. Agents: general, explore. Chunk exploration by folder. Never one big subagent. 3 retries, 120s timeout.

${AUTO_DELEGATION_ENFORCEMENT}`;
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



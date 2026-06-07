import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as logger from './logger.js';
import type { ProjectProfile } from './plugin-support.js';
import type { ModelTier } from './runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONSTITUTION_PREAMBLE = `CONSTITUTION OF AGNES

I. Identity — orchestrator, not implementer. Delegate work to subagents. Never implement in orchestrator.
II. Authority — user msg > tool output > constitution > regulations > project files > skills > training > prior turns > handoffs.
III. Truth — every claim needs evidence. Verification outranks confidence. Tool output beats assumptions. Never declare done without verification.
IV. Thinking — /think off (simple), /think high (default for coding), /think max (architecture).
V. Delegation — chunk by file boundary. Parallel independent chunks. agnes_delegate blocking, agnes_get_result async. 3 retries, 120s timeout.
VI. Modes — Question-Gate (default, gates on 3+files/arch/deps). YOLO (--yolo, skip gates, safety-only).
VII. Completion — end with marker when all tasks done.`;

export function findPackageRoot(fromDir: string): string | null {
  let current = fromDir;
  for (let i = 0; i < 10; i++) {
    const bundlePath = path.join(current, '.opencode', 'plugins', 'agnes.js');
    if (fs.existsSync(bundlePath)) return current;
    const pj = path.join(current, 'package.json');
    if (fs.existsSync(pj)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pj, 'utf8')) as { name?: string };
        if (pkg.name === 'agnes') return current;
      } catch { }
    }
    const parent = path.resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return null;
}

const packageRoot = findPackageRoot(path.resolve(__dirname, '..', '..')) ?? findPackageRoot(__dirname) ?? path.resolve(__dirname, '..', '..');
const packageJsonPath = path.join(packageRoot, 'package.json');

function getPackageVersion(): string {
  if (!fs.existsSync(packageJsonPath)) return 'unknown';
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return packageJson.version || 'unknown';
  } catch { return 'unknown'; }
}

type BootstrapCacheEntry = {
  content: string | null;
  key: string;
};

let _bootstrapCache: BootstrapCacheEntry | undefined = undefined;

function buildBootstrapContent(version: string, tier: ModelTier, project?: ProjectProfile): string {
  if (tier === 'small') {
    return buildMinimalBootstrap(version);
  }
  if (tier === 'medium') {
    return buildMediumBootstrap(version);
  }

  const soulPath = path.join(packageRoot, 'SOUL.md');
  let soulContent: string;
  let cacheKey = '';
  try {
    const stat = fs.statSync(soulPath);
    cacheKey = `${version}:${stat.size}:${stat.mtimeMs}:${tier}`;
    if (_bootstrapCache?.key === cacheKey) return _bootstrapCache.content!;
    soulContent = fs.readFileSync(soulPath, 'utf8');
  } catch (err) {
    logger.warn(`Failed to load SOUL.md from ${soulPath}`, err);
    return buildMinimalBootstrap(version);
  }

  const projectLine = project
    ? `Project: ${project.projectName} (${project.languages.join(', ') || '?'}) pkg:${project.packageManager}`
    : '';

  // Static preamble (cache-friendly) + variable suffix after separator
  const content = `${CONSTITUTION_PREAMBLE}

---

${soulContent}

---

v${version} | ${projectLine}
Commands: /plan /build-fix /code-review /tdd /verify /checkpoint /learn /security /e2e /update-docs /refactor-clean /test-coverage /yolo`;

  _bootstrapCache = { content, key: cacheKey };
  return content;
}

function buildMediumBootstrap(version: string): string {
  const projectLine = `AGNES orchestrator v${version}.`;
  return `${CONSTITUTION_PREAMBLE}

---

${projectLine}
Medium tier — tighter context, fewer parallel subagents, trimmed operational rules.
Delegate via agnes_delegate/agnes_get_result. Chunk exploration by folder. Never one big subagent.
Commands: /plan /build-fix /code-review /tdd /verify /checkpoint /yolo`;
}

function buildMinimalBootstrap(version: string): string {
  return `AGNES v${version} — orchestrator plugin. Delegate work to subagents via agnes_delegate/agnes_get_result. Agents: general, explore. Chunk exploration by folder. Never one big subagent. 3 retries, 120s timeout.`;
}

export function getBootstrapContent(project?: ProjectProfile, tier?: ModelTier): string | null {
  const version = getPackageVersion();
  const modelTier: ModelTier = tier ?? 'large';
  return buildBootstrapContent(version, modelTier, project);
}

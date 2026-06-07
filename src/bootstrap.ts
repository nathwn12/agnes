import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as logger from './logger.js';
import type { ProjectProfile } from './plugin-support.js';
import type { ModelTier } from './runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  // Small models get minimal bootstrap — medium get trimmed — large get full SOUL.md
  if (tier === 'small') {
    return buildMinimalBootstrap(version);
  }
  if (tier === 'medium') {
    return buildMediumBootstrap(version);
  }

  const soulPath = path.join(packageRoot, 'SOUL.md');
  let soulContent: string;
  try {
    const stat = fs.statSync(soulPath);
    const statKey = `${version}:${stat.size}:${stat.mtimeMs}:${tier}`;
    if (_bootstrapCache?.key === statKey) return _bootstrapCache.content!;
    soulContent = fs.readFileSync(soulPath, 'utf8');
  } catch (err) {
    logger.warn(`Failed to load SOUL.md from ${soulPath}`, err);
    return buildMinimalBootstrap(version);
  }

  const projectLine = project
    ? ` Project: ${project.projectName} (${project.languages.join(', ') || '?'}) pkg:${project.packageManager}`
    : '';

  const content = `[AGNES v${version}]${projectLine}

DELEGATE: agnes_delegate(agent,desc,prompt,bg=false) blocking | bg=true returns ref. agnes_get_result(ref) poll. agents: general(read/write/research), explore(read-only).
MODE: default=question-gate (gate on 3+files|arch|newdeps|structural). --yolo/--auto=/yolo flag = YOLO (skip gates, max parallel, safety-only interrupts).
SLASH: /plan /build-fix /code-review /tdd /verify /checkpoint /learn /security /e2e /update-docs /refactor-clean /test-coverage /yolo

${soulContent}

## COMPLETE
When done, end response with: §AM{"t":"result","i":"task-000","s":"DONE","c":"...","a":{}}`;

  _bootstrapCache = { content, key: `${version}:${soulContent.length}:${Date.now()}` };
  return content;
}

function buildMediumBootstrap(version: string): string {
  return `[AGNES v${version}] Orchestrator plugin. Use agnes_delegate/agnes_get_result for subagent work. Always chunk exploration — never one big subagent. Split by folder or 10-15 files per subagent. SOUL.md available but trimmed — fewer parallel subagents, tighter context.`;
}

function buildMinimalBootstrap(version: string): string {
  return `[AGNES v${version}] Orchestrator plugin. Use agnes_delegate/agnes_get_result for subagent work. Agents: general, explore. Chunk exploration by folder — never one big subagent.`;
}

export function getBootstrapContent(project?: ProjectProfile, tier?: ModelTier): string | null {
  const version = getPackageVersion();
  const modelTier: ModelTier = tier ?? 'large';
  return buildBootstrapContent(version, modelTier, project);
}

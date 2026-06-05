import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlanSummary } from './state.js';
import type { PlanIndex, PlannerRoutingContext } from './state.js';
import * as logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function findPackageRoot(fromDir: string): string | null {
  let current = fromDir;
  for (let i = 0; i < 5; i++) {
    const pj = path.join(current, 'package.json');
    if (fs.existsSync(pj)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pj, 'utf8')) as { name?: string };
        if (pkg.name === 'agnes') return current;
      } catch {
      }
    }
    const parent = path.resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return null;
}

const packageRoot = findPackageRoot(path.resolve(__dirname, '..', '..')) ?? findPackageRoot(__dirname) ?? path.resolve(__dirname, '..', '..');
const packageJsonPath = path.join(packageRoot, 'package.json');
const opencodePackageCache = path.join(os.homedir(), '.cache', 'opencode', 'packages');

function getPackageVersion(): string {
  if (!fs.existsSync(packageJsonPath)) return 'unknown';
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

type BootstrapCacheEntry = {
  content: string | null;
  key: string;
};

let _bootstrapCache: BootstrapCacheEntry | undefined = undefined;

export function getStaticBootstrapContent(): string | null {
  const soulPath = path.join(packageRoot, 'SOUL.md');
  const version = getPackageVersion();
  try {
    const stat = fs.statSync(soulPath);
    const statKey = `${version}:${stat.size}:${stat.mtimeMs}`;
    if (_bootstrapCache?.key === statKey) return _bootstrapCache.content;

    const fullContent = fs.readFileSync(soulPath, 'utf8');

    const staticContent = buildBootstrapFromSoul(fullContent, version);
    _bootstrapCache = { content: staticContent, key: statKey };
    return staticContent;
  } catch (err) {
    logger.warn(`Failed to load SOUL.md from ${soulPath}`, err);
    return buildMinimalBootstrap(version);
  }
}

function buildBootstrapFromSoul(fullContent: string, version: string): string {
  return `<EXTREMELY_IMPORTANT>
You are AGNES v${version}.

**Runtime Identity**
- AGNES package root: \`${packageRoot}\`
- OpenCode package cache: \`${opencodePackageCache}\`
- If the user asks to clear AGNES cache, tell them to delete the package cache dir and restart OpenCode.

**Delegation Protocol**
Use \`agnes_delegate\` and \`agnes_get_result\` for subagent work. Built-in \`delegate_task\`/\`get_task_result\` are DEPRECATED.
- \`agnes_delegate(agent, description, prompt, background=false)\` → blocking, returns result inline.
- \`agnes_delegate(agent, description, prompt, background=true)\` → returns task ref for polling.
- \`agnes_get_result(taskRef)\` → polls async result. Returns output text, PENDING, or ERROR.

Available agents: @explore (read/search), @build (modify/create). Other custom agents have been removed — use commands instead.

**Commands**
Use slash commands for structured workflows: /plan, /build-fix, /code-review, /tdd, /verify, /checkpoint, /learn, /security, /e2e, /update-docs, /refactor-clean, etc.

**Rules**
- Decompose work by file boundary before delegating.
- Parallelize independent chunks.
- Verify work before claiming done.
- Change only what is required.
- Answer simple questions directly — no delegation overhead.

**IMPORTANT: SOUL.md instructions are loaded below.**

${fullContent.trim()}
</EXTREMELY_IMPORTANT>`;
}

function buildMinimalBootstrap(version: string): string {
  return `<EXTREMELY_IMPORTANT>
You are AGNES v${version}.

Use \`agnes_delegate\` and \`agnes_get_result\` for subagent work.
Available agents: @explore (read/search), @build (modify/create).
Use slash commands for structured workflows.

Delegate work. Verify results. Answer directly.
</EXTREMELY_IMPORTANT>`;
}

export function getBootstrapContent(planner?: PlannerRoutingContext, projectRoot?: string, index?: PlanIndex | null): string | null {
  const staticContent = getStaticBootstrapContent();
  if (!staticContent) return null;

  const planSummary = buildPlanSummary(projectRoot ?? process.cwd(), planner, index);

  return `${staticContent}

<AGNES_PLAN_STATE>
${planSummary}
</AGNES_PLAN_STATE>`;
}

export function getBootstrapPackageInfo(): { version: string; root: string; skillsDir: string; cacheRoot: string } {
  return {
    version: getPackageVersion(),
    root: packageRoot,
    skillsDir: '',
    cacheRoot: opencodePackageCache,
  };
}

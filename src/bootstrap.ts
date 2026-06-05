import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlanSummary } from './state.js';
import type { PlanIndex, PlannerRoutingContext } from './state.js';

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
const skillsDir = path.join(packageRoot, '.opencode', 'skills');
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
  if (!fs.existsSync(soulPath)) return null;
  const version = getPackageVersion();
  try {
    const stat = fs.statSync(soulPath);
    const statKey = `${version}:${stat.size}:${stat.mtimeMs}`;
    if (_bootstrapCache?.key === statKey) return _bootstrapCache.content;

    const fullContent = fs.readFileSync(soulPath, 'utf8');

    const toolMapping = `**Tool Mapping for OpenCode:**
When skills reference tools you don't have, substitute OpenCode equivalents:
- \`TodoWrite\` → \`todowrite\`
- \`Task\` with subagents → OpenCode's subagent system (@mention)
- \`Skill\` → OpenCode's native \`skill\` tool
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` → Your native tools

Use OpenCode's native \`skill\` tool to list and load skills.`;

    const staticContent = `<EXTREMELY_IMPORTANT>
You are AGNES.

**Runtime Identity** (AGNES internal install paths — distinct from the current project workspace)
- Current AGNES version: \`${version}\`
- Installed AGNES package root: \`${packageRoot}\`
- Bundled AGNES skills directory: \`${skillsDir}\`
- OpenCode package cache root: \`${opencodePackageCache}\`
- If the user asks to clear AGNES's cache, tell them to delete the package cache directory above and restart OpenCode. Never generate or run destructive commands yourself.

=== AGNES ORCHESTRATION CONTRACT ===
You are the MAIN AGENT. You DELEGATE. You NEVER execute directly.

**FRAGMENT FIRST — then delegate**
Every task MUST be split into the smallest possible independent chunks BEFORE delegating. Decompose by directory, file, or concern. Fire N subagents in parallel — one per chunk. Never assign a monolithic task to a single subagent.

- **Exploration**: Split by top-level subdirectory. Fire one @explore per dir in parallel. Never one explore agent for the whole tree.
- **Multi-step builds/coding/editing**: Split by file boundary. Fire one @general per file in parallel. Never one agent touching 3+ files sequentially.
- **Trivial** (1 file, simple change): Do it directly or fire 1 subagent. No fragmentation overhead.

**Delegation, Not Execution**
- Every task goes to a subagent. If you find yourself doing the work, stop and fire a subagent.
- Subagents execute. You coordinate, route, synthesize results.
- NEVER two subagents touching the same file. Split by file boundaries.

**Auto Difficulty Detection**
- Trivial (1 file, simple change): Do it directly or fire 1 subagent.
- Multi-step (3+ files, cross-module): Fire parallel subagents immediately — one per file.
- Complex (architecture, refactor): Plan first, then fire N subagents in parallel.
- Reassess constantly. If it gets more complex mid-flight, fire up more subagents.

**Parallel Execution**
- Run subagents in parallel whenever work is independent.
- Zero shared state. Zero coordination overhead. Each subagent is fully isolated.
- Results flow back to you for synthesis.

**Ask Once Gate**
- For destructive, irreversible, or major decisions: present recommended options.
- Synthesize the best path. User selects. No open-ended questions.
- Say: "Option A (recommended), Option B, Option C. Pick one." Never ask "what should I do?"

**Planning Mode**
- Present suggested paths. The user selects. Less talking, more deciding.

=== END AGNES ORCHESTRATION CONTRACT ===

=== AGNES ROUTING ===
- @explore — Read-only agent for search, code review, research, lookup, understanding existing code
- @general — Implementation agent with bash+write access for modifying files, running commands, testing
- Destructive/lossy/irreversible → Ask user first
- Available subagents: explore (read-only), build (write+bash), plan (read-only), general (bash)
- /agent-hub — List available agents, skills, and commands
=== END AGNES ROUTING ===

**IMPORTANT: AGNES SOUL.md is loaded below.**

${fullContent.trim()}

${toolMapping}
</EXTREMELY_IMPORTANT>`;

    _bootstrapCache = { content: staticContent, key: statKey };
    return staticContent;
  } catch {
    return null;
  }
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
    skillsDir,
    cacheRoot: opencodePackageCache,
  };
}

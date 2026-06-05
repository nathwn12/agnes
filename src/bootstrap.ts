import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlanSummary, getLatestActivePlan } from './state.js';
import type { PlanIndex, PlannerRoutingContext } from './state.js';
import { stringify as yamlDump } from 'yaml';
import type { CompactionPolicyState } from './compaction.js';

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
        // ignore malformed package.json and keep walking
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
    const cacheNukeCommand = `powershell -Command "Remove-Item -LiteralPath \\\"\\\\?\\$env:USERPROFILE\\.cache\\opencode\\packages\\agnes@git+https_\\\" -Recurse -Force"`;

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
- If the user explicitly asks to clear or nuke AGNES's OpenCode cache, remove the installed AGNES cache directory or use: \`${cacheNukeCommand}\`, then restart OpenCode.

=== AGNES ORCHESTRATION CONTRACT ===
You are the MAIN AGENT. You DELEGATE. You NEVER execute directly.

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
- Read/search/lookup anything → @explore
- Modify/create/run/delete anything → @general
- Destructive/lossy/irreversible → Ask user first
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

// ── Structured Protocol block builders ───────────────────────────────────────

export interface BootstrapContext {
  pkg: { version: string; root: string; skillsDir: string; cacheRoot: string };
  index: PlanIndex | null;
  planner?: PlannerRoutingContext;
  exec: { attempt: number; struggleDetected: boolean; lastPromiseTag: string | null };
}

function wrapStructured(type: string, inner: string): string {
  return `<structured type="${type}">\n${inner}\n</structured>`;
}

export function buildRuntimeBlock(pkg: { version: string; root: string; skillsDir: string; cacheRoot: string }): string {
  return wrapStructured('runtime', yamlDump({
    type: 'runtime',
    agnes_version: pkg.version,
    package_root: pkg.root,
    skills_dir: pkg.skillsDir,
    cache_root: pkg.cacheRoot,
  }));
}

export function buildPlanStateBlock(index: PlanIndex | null, planner?: PlannerRoutingContext): string {
  const plan = index ? getLatestActivePlan(index.projectDir) : null;
  if (!plan) {
    return wrapStructured('plan_state', yamlDump({
      type: 'plan_state',
      active_plan: null,
      status: 'none',
      message: 'No active plan. For simple tasks, just ask. For complex tasks, use the current planner path.',
      ...(planner ? {
        planner_mode: planner.mode,
        planner_route: planner.route,
        planner_reason: planner.reason,
      } : {}),
    }));
  }
  return wrapStructured('plan_state', yamlDump({
    type: 'plan_state',
    active_plan: plan.entry.id,
    status: plan.entry.status,
    completed: plan.entry.completed,
    total: plan.entry.total,
    blocked: plan.entry.blocked,
    goal: plan.entry.summary || 'No goal set',
    struggle_detected: (plan.entry.struggle?.noProgressIterations || 0) >= 3,
    ...(plan.entry.plannerMode ? { planner_mode: plan.entry.plannerMode } : {}),
    ...(plan.entry.plannerSource ? { planner_source: plan.entry.plannerSource } : {}),
    ...(planner ? {
      planner_mode: planner.mode,
      planner_route: planner.route,
      planner_reason: planner.reason,
    } : {}),
  }));
}

export function buildExecutionContextBlock(ctx: {
  attempt: number;
  struggleDetected: boolean;
  lastPromiseTag: string | null;
  compaction?: CompactionPolicyState;
}): string {
  return wrapStructured('execution', yamlDump({
    type: 'execution',
    attempt: ctx.attempt || 1,
    struggle_detected: ctx.struggleDetected || false,
    last_promise_tag: ctx.lastPromiseTag || null,
    ...(ctx.compaction ? {
      compaction: {
        token_count: ctx.compaction.tokenCount,
        soft_limit: ctx.compaction.softLimit,
        hard_limit: ctx.compaction.hardLimit,
        last_action: ctx.compaction.lastAction,
        last_reason: ctx.compaction.lastReason,
        last_triggered_at: ctx.compaction.lastTriggeredAt,
      },
    } : {}),
  }));
}

export function getBootstrapPackageInfo(): { version: string; root: string; skillsDir: string; cacheRoot: string } {
  return {
    version: getPackageVersion(),
    root: packageRoot,
    skillsDir,
    cacheRoot: opencodePackageCache,
  };
}

export function buildBootstrap(context: BootstrapContext): string {
  const blocks: string[] = [
    buildRuntimeBlock(context.pkg),
    ...(context.index || context.planner ? [buildPlanStateBlock(context.index, context.planner)] : []),
    buildExecutionContextBlock(context.exec),
  ];
  return blocks.filter(Boolean).join('\n');
}

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlanSummary, getLatestActivePlan } from './state.js';
import type { PlanIndex } from './state.js';
import { resolveSkillName } from './schema.js';
import { detectShell } from './shell.js';
import { parse as yamlParse, stringify as yamlDump } from 'yaml';
import type { CompactionPolicyState } from './compaction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findPackageRoot(fromDir: string): string | null {
  let current = fromDir;
  for (let i = 0; i < 5; i++) {
    const pj = path.join(current, 'package.json');
    if (fs.existsSync(pj)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pj, 'utf8')) as { name?: string };
        if (pkg.name === 'agnes') return current;
      } catch {}
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

function extractFrontmatter(content: string): { content: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { content };
  return { content: match[2] };
}

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

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function getStaticBootstrapContent(): string | null {
  const skillPath = path.join(skillsDir, 'orchestrator', 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    return null;
  }

  const version = getPackageVersion();
  const fullContent = fs.readFileSync(skillPath, 'utf8');
  const cacheKey = `${version}:${simpleHash(fullContent)}`;

  if (_bootstrapCache?.key === cacheKey) {
    return _bootstrapCache.content;
  }
  const { content: frontmatterContent } = extractFrontmatter(fullContent);

  const bootstrapEnd = frontmatterContent.indexOf('<!-- bootstrap-end -->');
  const trimmedContent = bootstrapEnd !== -1 ? frontmatterContent.slice(0, bootstrapEnd).trim() : frontmatterContent;
  const cacheNukeCommand = `rm -rf "$HOME/.cache/opencode/packages"/agnes@git+https_*`;

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

**IMPORTANT: The orchestrator skill content is below. It is ALREADY LOADED. Do NOT use the skill tool to load "orchestrator" again.**

${trimmedContent}

${toolMapping}
</EXTREMELY_IMPORTANT>`;

  _bootstrapCache = { content: staticContent, key: cacheKey };
  return staticContent;
}

export function getBootstrapContent(): string | null {
  const staticContent = getStaticBootstrapContent();
  if (!staticContent) return null;

  const planSummary = buildPlanSummary(process.cwd());

  const shell = detectShell();

  const skillRegistryText = buildSkillRegistryText();

  let content = `${staticContent}

<AGNES_PLAN_STATE>
${planSummary}
</AGNES_PLAN_STATE>

<SHELL_ENVIRONMENT>
${shell.guidance}
Anti-pattern commands to avoid: ${shell.antiPatterns.join(', ')}
</SHELL_ENVIRONMENT>`;

  if (skillRegistryText) {
    content += `\n\n${skillRegistryText}\n`;
  }

  return content;
}

// ── Wave 3: Structured Protocol block builders ───────────────────────────────

export interface OrchestratorRules {
  delegate: boolean;
  parallelize: boolean;
  onePercent: boolean;
  verify: boolean;
  noSharedEdits: boolean;
  freshSubagents: boolean;
  scarcity: boolean;
  answerDirectly: boolean;
  namedRoles: Record<string, string>;
}

export interface BootstrapContext {
  pkg: { version: string; root: string; skillsDir: string; cacheRoot: string };
  rules: OrchestratorRules;
  index: PlanIndex | null;
  shell: { name: string; version: string; antiPatterns: string[]; preferredSyntax: string };
  exec: { attempt: number; struggleDetected: boolean; lastPromiseTag: string | null };
}

function wrapStructured(type: string, inner: string): string {
  return `<structured type="${type}">\n${inner}\n</structured>`;
}

export function buildRuntimeBlock(pkg: { version: string; root: string; skillsDir: string; cacheRoot: string }): string {
  return wrapStructured("runtime", yamlDump({
    type: "runtime",
    agnes_version: pkg.version,
    package_root: pkg.root,
    skills_dir: pkg.skillsDir,
    cache_root: pkg.cacheRoot,
  }));
}

export function buildOrchestratorBlock(rules: OrchestratorRules): string {
  return wrapStructured("orchestrator", yamlDump({
    type: "orchestrator",
    rules: {
      delegate_or_die: rules.delegate,
      parallelize_by_default: rules.parallelize,
      one_percent_rule: rules.onePercent,
      verify_before_claiming: rules.verify,
      no_shared_file_edits: rules.noSharedEdits,
      fresh_subagents_per_wave: rules.freshSubagents,
      scarcity_principle: rules.scarcity,
    },
  }));
}

export function buildNamedRolesBlock(rules: OrchestratorRules): string {
  return wrapStructured("named_roles", yamlDump({
    type: "named_roles",
    roles: rules.namedRoles,
    answer_directly: rules.answerDirectly,
  }));
}

export function buildPlanStateBlock(index: PlanIndex): string {
  const plan = getLatestActivePlan(index.projectDir);
  if (!plan) {
    return wrapStructured("plan_state", yamlDump({
      type: "plan_state",
      active_plan: null,
      status: "none",
      message: "No active plan. For simple tasks, just ask. For complex tasks, I'll suggest firing up init.",
    }));
  }
  return wrapStructured("plan_state", yamlDump({
    type: "plan_state",
    active_plan: plan.entry.id,
    status: plan.entry.status,
    completed: plan.entry.completed,
    total: plan.entry.total,
    blocked: plan.entry.blocked,
    goal: plan.entry.summary || "No goal set",
    struggle_detected: (plan.entry.struggle?.noProgressIterations || 0) >= 3,
  }));
}

export function buildShellBlock(shell: { name: string; version: string; antiPatterns: string[]; preferredSyntax: string }): string {
  return wrapStructured("shell", yamlDump({
    type: "shell",
    detected: shell.name,
    version: shell.version,
    anti_patterns: shell.antiPatterns,
    preferred_syntax: shell.preferredSyntax,
  }));
}

export function buildExecutionContextBlock(ctx: {
  attempt: number;
  struggleDetected: boolean;
  lastPromiseTag: string | null;
  compaction?: CompactionPolicyState;
}): string {
  return wrapStructured("execution", yamlDump({
    type: "execution",
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

export function buildProtocolBlock(): string {
  return wrapStructured("protocol", yamlDump({
    type: "protocol",
    marker_prefix: "agnes:message",
    types: ["task", "result", "error", "status", "completion"],
  }));
}

// ── Skill registry (compact, auto-discovered from frontmatter) ─────────────

  const SKILL_SUGGEST_NEXT: Record<string, string[]> = {
  'clarifier': ['explorer', 'planner'],
  'explorer': ['architect', 'planner'],
  'architect': ['planner'],
  'planner': ['multi-reviewer'],
  'multi-reviewer': ['tdd', 'builder'],
  'prd': ['planner'],
  'prototype': ['tdd', 'builder'],
  'builder': ['tester', 'verifier'],
  'tdd': ['verifier'],
  'tester': ['reviewer'],
  'verifier': ['reviewer', 'shipper'],
  'reviewer': ['documenter', 'shipper'],
  'feedback-receiver': ['builder', 'debugger'],
  'debugger': ['verifier'],
  'griller': ['debugger', 'verifier'],
  'shipper': ['documenter', 'retro'],
  'triage': ['planner', 'debugger'],
  'documenter': ['retro'],
  'retro': [],
  'skillwriter': ['tdd'],
  'brandkit': ['prototype', 'builder'],
  'init': ['clarifier', 'explorer'],
};

function readSkillRegistry(): Array<{ id: string; phase: string; suggest_next: string[] }> {
  if (!fs.existsSync(skillsDir)) return [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills: Array<{ id: string; phase: string; suggest_next: string[] }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sp = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(sp)) continue;
    try {
      const raw = fs.readFileSync(sp, 'utf8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!m) continue;
      const fm = yamlParse(m[1]) as Record<string, unknown>;
      if (typeof fm.id !== 'string' || typeof fm.phase !== 'string') continue;
      const id = resolveSkillName(fm.id);
      skills.push({ id, phase: fm.phase.toUpperCase(), suggest_next: (SKILL_SUGGEST_NEXT[id] || []).map(resolveSkillName) });
    } catch { /* skip unparseable skills */ }
  }
  return skills.sort((a, b) => a.id.localeCompare(b.id));
}

export function buildSkillRegistryBlock(): string {
  const skills = readSkillRegistry();
  if (!skills.length) return '';
  return wrapStructured('skill_registry', yamlDump({ type: 'skill_registry', skills }));
}

export function buildSkillRegistryText(): string {
  const skills = readSkillRegistry();
  if (!skills.length) return '';
  const lines = ['### Skill Registry (next-skill suggestions)\n'];
  for (const s of skills) {
    if (s.suggest_next.length) lines.push(`- **${s.id}** (${s.phase}) → next: ${s.suggest_next.join(', ')}`);
  }
  return lines.join('\n');
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
    buildOrchestratorBlock(context.rules),
    buildNamedRolesBlock(context.rules),
    ...(context.index ? [buildPlanStateBlock(context.index)] : []),
    buildShellBlock(context.shell),
    buildExecutionContextBlock(context.exec),
    buildProtocolBlock(),
    buildSkillRegistryBlock(),
  ];
  return blocks.filter(Boolean).join("\n");
}

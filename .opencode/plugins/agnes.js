// @bun
// src/plugin.ts
import { randomUUID } from "crypto";
import * as path4 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/bootstrap.ts
import * as fs2 from "fs";
import * as os3 from "os";
import * as path2 from "path";
import { fileURLToPath } from "url";

// src/state.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// src/protocol.ts
var VALID_TYPES = new Set([
  "task",
  "result",
  "error",
  "status",
  "completion"
]);
function serializeAgnesMessage(msg) {
  const json = JSON.stringify(msg);
  return `<agnes:message>${json}</agnes:message>`;
}

// src/state.ts
function assertShape(data, shape) {
  if (!data || typeof data !== "object")
    return false;
  const obj = data;
  for (const [field, expectedType] of Object.entries(shape)) {
    if (typeof obj[field] !== expectedType)
      return false;
  }
  return true;
}
var OPENCODE_CACHE_ROOT = path.join(os.homedir(), ".cache", "opencode", "packages");
var AGNES_DIR = ".agnes";
var PLANS_DIR = "plans";
function isBlockedPath(dir) {
  const resolved = path.resolve(dir);
  const root = path.resolve(OPENCODE_CACHE_ROOT);
  if (os.platform() === "win32") {
    return resolved.toLowerCase().startsWith(root.toLowerCase());
  }
  return resolved.startsWith(root);
}
function getPlanFilePath(root, entry) {
  const filename = entry.file || `${entry.id}.md`;
  return path.join(root, AGNES_DIR, PLANS_DIR, filename);
}
var _cachedProjectRoot = null;
function findProjectRoot(startDir) {
  if (_cachedProjectRoot && !startDir) {
    const indexPath = path.join(_cachedProjectRoot, AGNES_DIR, "index.json");
    if (fs.existsSync(indexPath)) {
      return _cachedProjectRoot;
    }
    _cachedProjectRoot = null;
  }
  let dir = startDir ? path.resolve(startDir) : process.cwd();
  let found = null;
  for (let i = 0;i < 20; i++) {
    if (isBlockedPath(dir))
      break;
    if (dir === os.homedir())
      break;
    if (fs.existsSync(path.join(dir, AGNES_DIR, "index.json"))) {
      found = dir;
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir)
      break;
    dir = parent;
  }
  if (!startDir && found) {
    _cachedProjectRoot = found;
  }
  return found;
}
function cacheDir(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    return null;
  return path.join(root, AGNES_DIR);
}
var ENTRY_REQUIRED_SHAPE = {
  id: "string",
  status: "string",
  createdAt: "string",
  updatedAt: "string",
  summary: "string",
  total: "number",
  completed: "number",
  blocked: "number"
};
var INDEX_REQUIRED_SHAPE = {
  agnesVersion: "string",
  schemaVersion: "number",
  projectDir: "string",
  projectName: "string",
  updatedAt: "string",
  plans: "object"
};
function validatePlanIndex(raw) {
  if (!raw || typeof raw !== "object")
    return false;
  const idx = raw;
  if (!assertShape(idx, INDEX_REQUIRED_SHAPE))
    return false;
  if (idx.schemaVersion !== 2)
    return false;
  if (idx.activePlanId !== null && typeof idx.activePlanId !== "string")
    return false;
  if (!Array.isArray(idx.plans))
    return false;
  for (const entry of idx.plans) {
    if (!assertShape(entry, ENTRY_REQUIRED_SHAPE))
      return false;
  }
  return true;
}
function migratePlanEntry(entry) {
  let changed = false;
  if (!entry.file) {
    entry.file = `${entry.id}.md`;
    changed = true;
  }
  if (typeof entry.attempts !== "number") {
    entry.attempts = 0;
    changed = true;
  }
  if (!entry.struggle) {
    entry.struggle = freshStruggleMetrics();
    changed = true;
  }
  return changed;
}
function readPlanIndex(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    return null;
  const indexPath = path.join(root, AGNES_DIR, "index.json");
  try {
    const raw = fs.readFileSync(indexPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!validatePlanIndex(parsed))
      return null;
    let migrated = false;
    for (const entry of parsed.plans) {
      if (migratePlanEntry(entry))
        migrated = true;
    }
    if (migrated)
      writePlanIndex(parsed, root);
    pruneExpiredPlans(parsed, root);
    return parsed;
  } catch {
    return null;
  }
}
function writePlanIndex(index, projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    throw new Error("Cannot write plan index: no project root found");
  const dir = path.join(root, AGNES_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "index.json");
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}
var DEFAULT_RETENTION = { maxAgeDays: 7, terminalStatuses: ["done", "abandoned"] };
function pruneExpiredPlans(index, projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root || index.plans.length === 0)
    return index;
  const retention = index.retention ?? DEFAULT_RETENTION;
  const cutoffMs = Date.now() - retention.maxAgeDays * 24 * 60 * 60 * 1000;
  const terminalSet = new Set(retention.terminalStatuses);
  const kept = [];
  let changed = false;
  for (const entry of index.plans) {
    if (terminalSet.has(entry.status)) {
      const updatedMs = new Date(entry.updatedAt).getTime();
      if (!isNaN(updatedMs) && updatedMs <= cutoffMs) {
        try {
          fs.rmSync(getPlanFilePath(root, entry), { force: true });
        } catch {}
        changed = true;
        continue;
      }
    }
    kept.push(entry);
  }
  if (!changed)
    return index;
  index.plans = kept;
  index.updatedAt = new Date().toISOString();
  if (index.activePlanId && !kept.some((p) => p.id === index.activePlanId)) {
    index.activePlanId = null;
  }
  writePlanIndex(index, root);
  return index;
}
function getLatestActivePlan(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    return null;
  const index = readPlanIndex(root);
  if (!index)
    return null;
  const activeStatuses = ["draft", "reviewed", "ready", "in_progress", "blocked"];
  let target;
  if (index.activePlanId) {
    const entry = index.plans.find((p) => p.id === index.activePlanId);
    if (entry && activeStatuses.includes(entry.status)) {
      target = entry;
    }
  }
  if (!target) {
    const sorted = [...index.plans].filter((p) => activeStatuses.includes(p.status)).sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      if (isNaN(aTime) && isNaN(bTime))
        return b.id.localeCompare(a.id);
      if (isNaN(aTime))
        return 1;
      if (isNaN(bTime))
        return -1;
      const diff = bTime - aTime;
      if (diff !== 0)
        return diff;
      return b.id.localeCompare(a.id);
    });
    target = sorted[0];
  }
  if (!target)
    return null;
  const planPath = getPlanFilePath(root, target);
  try {
    const content = fs.readFileSync(planPath, "utf8");
    return { entry: target, content };
  } catch {
    return null;
  }
}
function buildPlanSummary(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    return "No active plan. Create one before delegating work.";
  const index = readPlanIndex(root);
  if (!index || index.plans.length === 0)
    return "No active plan. Create one before delegating work.";
  const active = getLatestActivePlan(root);
  if (!active)
    return "No active plan. Create one before delegating work.";
  const { entry } = active;
  const goalMatch = active.content.match(/^Goal:\s*(.+)$/m);
  const goal = goalMatch ? goalMatch[1] : "";
  let line = `Active Plan: ${entry.id} (${entry.status}) \u2014 ${entry.completed}/${entry.total} tasks done
Goal: ${goal}
Latest update: ${entry.updatedAt}`;
  if (entry.attempts !== undefined && entry.attempts > 0) {
    line += `
Attempts: ${entry.attempts}`;
  }
  if (entry.struggle) {
    const s = entry.struggle;
    const parts = [];
    if (s.noProgressIterations > 0)
      parts.push(`no-progress:${s.noProgressIterations}`);
    if (s.shortIterations > 0)
      parts.push(`short-runs:${s.shortIterations}`);
    const errCount = Object.keys(s.repeatedErrors).length;
    if (errCount > 0)
      parts.push(`repeated-errors:${errCount}`);
    if (s.lastPromiseTag)
      parts.push(`last-promise:${s.lastPromiseTag}`);
    if (s.shellType)
      parts.push(`shell:${s.shellType}`);
    if (parts.length > 0)
      line += `
Struggle: ${parts.join(", ")}`;
  }
  return line;
}
function freshStruggleMetrics() {
  return {
    noProgressIterations: 0,
    repeatedErrors: {},
    shortIterations: 0,
    lastPromiseTag: null
  };
}

// src/shell.ts
import * as os2 from "os";
var ANTI_PATTERNS = {
  "git-bash": ["Remove-Item", "Get-ChildItem", "New-Item", "Set-Content", "PowerShell", "powershell", "Get-Content", "Out-File", "Move-Item", "Copy-Item", "Write-Output", "Invoke-WebRequest", "ForEach-Object", "Where-Object", "Select-Object"],
  pwsh: ["Get-Content", "Set-Content", "Out-File", "Add-Content", "Get-ChildItem", "Select-String", "Remove-Item"],
  powershell: ["Get-Content", "Set-Content", "Out-File", "Add-Content", "Get-ChildItem", "Select-String", "Remove-Item"],
  cmd: [],
  wsl: ["Remove-Item", "Get-ChildItem"],
  unix: [],
  unknown: []
};
var GUIDANCE = {
  "git-bash": "You are running on Git Bash (MSYS2/MinGW). Use POSIX/bash commands (ls, rm, mkdir, cat, echo). NEVER use PowerShell commands like Remove-Item, Get-ChildItem, or Set-Content.",
  pwsh: "You are running on PowerShell 7+ (pwsh). Use PowerShell cmdlets and syntax.",
  powershell: "You are running on Windows PowerShell 5.1 (powershell.exe). Use PowerShell cmdlets and syntax.",
  cmd: "You are running on Windows Command Prompt (CMD). Use cmd.exe syntax.",
  wsl: "You are running on WSL (Windows Subsystem for Linux). Use bash commands.",
  unix: "You are running on a Unix/Linux/macOS shell. Use standard POSIX/bash commands.",
  unknown: "Shell type could not be determined. Use standard POSIX/bash commands."
};
var _cachedShell = null;
function detectShell() {
  if (_cachedShell)
    return _cachedShell;
  const env = process.env;
  const platform3 = os2.platform();
  const isWindows = platform3 === "win32";
  let shellType;
  let source;
  if (env.MSYSTEM) {
    shellType = "git-bash";
    source = "MSYSTEM";
  } else if (env.PSModulePath && !env.MSYSTEM) {
    if (env.PSEdition === "Core") {
      shellType = "pwsh";
      source = "PSEdition";
    } else {
      shellType = isWindows ? "powershell" : "unknown";
      source = "PSModulePath";
    }
  } else if (env.ComSpec?.toLowerCase().includes("cmd.exe") && !env.SHELL?.toLowerCase().includes("bash")) {
    shellType = "cmd";
    source = "ComSpec";
  } else if (env.SHELL) {
    const shellLower = env.SHELL.toLowerCase();
    if (shellLower.includes("bash") || shellLower.includes("zsh") || shellLower.includes("sh")) {
      shellType = isWindows ? "wsl" : "unix";
      source = "SHELL";
    } else {
      shellType = "unknown";
      source = "SHELL";
    }
  } else if (isWindows) {
    if (env.PSEdition === "Core") {
      shellType = "pwsh";
      source = "platform+PSEdition";
    } else {
      shellType = "powershell";
      source = "platform";
    }
  } else {
    shellType = "unix";
    source = "platform";
  }
  const isPowerShell = shellType === "pwsh" || shellType === "powershell";
  const preferredSyntax = shellType === "git-bash" || shellType === "wsl" || shellType === "unix" ? "bash" : shellType === "pwsh" || shellType === "powershell" ? "powershell" : "cmd";
  _cachedShell = {
    shellType,
    preferredSyntax,
    isWindows,
    isPowerShell,
    antiPatterns: ANTI_PATTERNS[shellType],
    guidance: GUIDANCE[shellType],
    source
  };
  return _cachedShell;
}

// src/bootstrap.ts
var __dirname2 = path2.dirname(fileURLToPath(import.meta.url));
function resolvePackageRoot(fromDir) {
  let current = fromDir;
  for (let i = 0;i < 5; i++) {
    const pj = path2.join(current, "package.json");
    if (fs2.existsSync(pj)) {
      try {
        const pkg = JSON.parse(fs2.readFileSync(pj, "utf8"));
        if (pkg.name === "agnes")
          return current;
      } catch {}
    }
    const parent = path2.resolve(current, "..");
    if (parent === current)
      break;
    current = parent;
  }
  return path2.resolve(fromDir, "..");
}
var packageRoot = resolvePackageRoot(__dirname2);
var packageJsonPath = path2.join(packageRoot, "package.json");
var skillsDir = path2.join(packageRoot, ".opencode", "skills");
var opencodePackageCache = path2.join(os3.homedir(), ".cache", "opencode", "packages");
function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match)
    return { content };
  return { content: match[2] };
}
function getPackageVersion() {
  if (!fs2.existsSync(packageJsonPath))
    return "unknown";
  try {
    const packageJson = JSON.parse(fs2.readFileSync(packageJsonPath, "utf8"));
    return packageJson.version || "unknown";
  } catch {
    return "unknown";
  }
}
var _bootstrapCache = undefined;
function simpleHash(str) {
  let hash = 0;
  for (let i = 0;i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
function getStaticBootstrapContent() {
  const skillPath = path2.join(skillsDir, "ag-orchestrator", "SKILL.md");
  if (!fs2.existsSync(skillPath)) {
    return null;
  }
  const version = getPackageVersion();
  const fullContent = fs2.readFileSync(skillPath, "utf8");
  const cacheKey = `${version}:${simpleHash(fullContent)}`;
  if (_bootstrapCache !== undefined && _bootstrapCache.key === cacheKey) {
    return _bootstrapCache.content;
  }
  const { content: frontmatterContent } = extractFrontmatter(fullContent);
  const bootstrapEnd = frontmatterContent.indexOf("<!-- bootstrap-end -->");
  const trimmedContent = bootstrapEnd !== -1 ? frontmatterContent.slice(0, bootstrapEnd).trim() : frontmatterContent;
  const cacheNukeCommand = `Remove-Item -Recurse -Force "$env:USERPROFILE\\.cache\\opencode\\packages\\agnes@git+https_*"`;
  const toolMapping = `**Tool Mapping for OpenCode:**
When skills reference tools you don't have, substitute OpenCode equivalents:
- \`TodoWrite\` \u2192 \`todowrite\`
- \`Task\` with subagents \u2192 OpenCode's subagent system (@mention)
- \`Skill\` \u2192 OpenCode's native \`skill\` tool
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` \u2192 Your native tools

Use OpenCode's native \`skill\` tool to list and load skills.`;
  const staticContent = `<EXTREMELY_IMPORTANT>
You are AGNES.

**Runtime Identity** (AGNES internal install paths \u2014 distinct from the current project workspace)
- Current AGNES version: \`${version}\`
- Installed AGNES package root: \`${packageRoot}\`
- Bundled AGNES skills directory: \`${skillsDir}\`
- OpenCode package cache root: \`${opencodePackageCache}\`
- If the user explicitly asks to clear or nuke AGNES's OpenCode cache, remove the installed AGNES cache directory or use: \`${cacheNukeCommand}\`, then restart OpenCode.

**IMPORTANT: The ag-orchestrator skill content is below. It is ALREADY LOADED. Do NOT use the skill tool to load "ag-orchestrator" again.**

${trimmedContent}

${toolMapping}
</EXTREMELY_IMPORTANT>`;
  _bootstrapCache = { content: staticContent, key: cacheKey };
  return staticContent;
}
function getBootstrapContent() {
  const staticContent = getStaticBootstrapContent();
  if (!staticContent)
    return null;
  const planSummary = buildPlanSummary(process.cwd());
  const shell = detectShell();
  return `${staticContent}

<AGNES_PLAN_STATE>
${planSummary}
</AGNES_PLAN_STATE>

<SHELL_ENVIRONMENT>
${shell.guidance}
Anti-pattern commands to avoid: ${shell.antiPatterns.join(", ")}
</SHELL_ENVIRONMENT>`;
}

// src/runtime.ts
import * as fs3 from "fs";
import * as path3 from "path";
var sessions = new Map;
loadSessions();
function sessionsFilePath(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    return null;
  const dir = cacheDir(root);
  return dir ? path3.join(dir, "sessions.json") : null;
}
function loadSessions(projectRoot) {
  try {
    const filePath = sessionsFilePath(projectRoot);
    if (!filePath)
      return;
    if (!fs3.existsSync(filePath))
      return;
    const raw = fs3.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    for (const [key, state] of Object.entries(data)) {
      if (state && typeof state.attempts === "number" && state.struggle && typeof state.lastAccessed === "number") {
        sessions.set(key, state);
      }
    }
  } catch {}
}
function getPlanState(workspaceRoot) {
  if (workspaceRoot === undefined) {
    workspaceRoot = findProjectRoot();
  }
  if (!workspaceRoot) {
    return { hasActivePlan: false, activePlan: null, planIndex: null, latestId: null };
  }
  const planIndex = readPlanIndex(workspaceRoot);
  if (!planIndex) {
    return { hasActivePlan: false, activePlan: null, planIndex: null, latestId: null };
  }
  const active = getLatestActivePlan(workspaceRoot);
  const latestId = planIndex.plans.length > 0 ? [...planIndex.plans].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    if (isNaN(aTime) && isNaN(bTime))
      return b.id.localeCompare(a.id);
    if (isNaN(aTime))
      return 1;
    if (isNaN(bTime))
      return -1;
    const diff = bTime - aTime;
    if (diff !== 0)
      return diff;
    return b.id.localeCompare(a.id);
  })[0].id : null;
  return {
    hasActivePlan: active !== null,
    activePlan: active,
    planIndex,
    latestId
  };
}
function getPlanGate(workspaceRoot) {
  const state = getPlanState(workspaceRoot);
  if (!state.planIndex) {
    return `
**PLAN REQUIRED:** No plan index found. Initialize AGNES state first.`;
  }
  if (!state.hasActivePlan) {
    return "\n**PLAN REQUIRED:** No active plan found. Create a plan with `.agnes/` before any implementation work.";
  }
  if (state.activePlan && state.activePlan.entry.status === "blocked") {
    return `
**BLOCKED PLAN:** ${state.activePlan.entry.id} is blocked. Resolve or create a new iteration.`;
  }
  return null;
}
function buildExecutionContext(entry) {
  const lines = [];
  if (entry.attempts !== undefined && entry.attempts > 0) {
    lines.push(`Current attempt: ${entry.attempts + 1}`);
  }
  const shell = detectShell();
  lines.push(`Shell: ${shell.shellType} (preferred syntax: ${shell.preferredSyntax})`);
  lines.push(`Shell guidance: ${shell.guidance}`);
  if (entry.struggle) {
    const s = entry.struggle;
    const warnings = [];
    if (s.noProgressIterations >= 3)
      warnings.push("multiple iterations without file changes");
    if (s.shortIterations >= 3)
      warnings.push("multiple very short iterations");
    const repeated = Object.entries(s.repeatedErrors).filter(([_, c]) => c >= 2).map(([err]) => `recurring error: "${err.substring(0, 60)}..."`);
    warnings.push(...repeated);
    if (warnings.length > 0) {
      lines.push("Struggle signals detected:");
      lines.push(...warnings.map((w) => `  - ${w}`));
    }
    if (s.lastPromiseTag) {
      lines.push(`Last promise tag seen: <promise>${s.lastPromiseTag}</promise>`);
    }
  }
  lines.push('Output {"type":"completion","status":"DONE","summary":"..."} when the task is genuinely complete.');
  return lines.join(`
`);
}
var IMPLEMENT_WORDS = new Set([
  "implement",
  "build",
  "add",
  "fix",
  "change",
  "create",
  "refactor",
  "write",
  "edit",
  "update",
  "remove",
  "delete",
  "broken",
  "fails",
  "error",
  "feature",
  "support",
  "need",
  "want",
  "should"
]);
var STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "and",
  "or",
  "is",
  "it",
  "be",
  "this",
  "that"
]);

// src/plugin.ts
var __dirname3 = path4.dirname(fileURLToPath2(import.meta.url));
var skillsDir2 = path4.resolve(__dirname3, "../skills");
var AgnesPlugin = async () => {
  return {
    config: async (config) => {
      detectShell();
      const configObj = config;
      const paths = configObj.skills?.paths ? [...configObj.skills.paths] : [];
      if (!paths.includes(skillsDir2)) {
        paths.push(skillsDir2);
      }
      configObj.skills = configObj.skills || {};
      configObj.skills.paths = paths;
    },
    "experimental.chat.messages.transform": async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages?.length)
        return;
      const firstUser = output.messages.find((m) => m.info?.role === "user");
      if (!firstUser || !firstUser.parts?.length)
        return;
      if (firstUser.parts.some((p) => p.type === "text" && typeof p.text === "string" && p.text.includes("EXTREMELY_IMPORTANT")))
        return;
      let planGate = "";
      let execContext = "";
      try {
        const workspaceRoot = findProjectRoot();
        if (workspaceRoot) {
          planGate = getPlanGate(workspaceRoot) || "";
          const index = readPlanIndex(workspaceRoot);
          if (index && index.activePlanId) {
            const activeEntry = index.plans.find((p) => p.id === index.activePlanId);
            if (activeEntry) {
              execContext = buildExecutionContext(activeEntry);
            }
          }
        }
      } catch {}
      let fullBootstrap = bootstrap + (planGate || "");
      if (execContext) {
        fullBootstrap += `

## Execution Context
${execContext}
`;
      }
      fullBootstrap += `

## Completion Protocol
When all tasks are complete, place this HTML comment at the very end of your response (invisible to users, parsed by AGNES):
<!-- ${serializeAgnesMessage({ type: "completion", id: randomUUID(), timestamp: new Date().toISOString(), status: "DONE", summary: "all tasks completed successfully" })} -->
For partial results:
<!-- ${serializeAgnesMessage({ type: "result", taskId: "task-000", id: randomUUID(), timestamp: new Date().toISOString(), status: "DONE", content: "...", artifact: {} })} -->
`;
      const { sessionID, messageID } = firstUser.parts[0];
      firstUser.parts.unshift({
        id: randomUUID(),
        sessionID,
        messageID,
        type: "text",
        text: fullBootstrap
      });
    }
  };
};
export {
  AgnesPlugin
};

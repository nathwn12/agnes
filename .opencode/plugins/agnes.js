// @bun
// src/plugin.ts
import { randomUUID } from "crypto";
import * as path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/bootstrap.ts
import * as fs2 from "fs";
import * as os2 from "os";
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
function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenceStart = trimmed.match(/^```(?:json)?\s*\n/);
  const fenceEnd = trimmed.match(/\n```\s*$/);
  if (fenceStart && fenceEnd) {
    return trimmed.slice(fenceStart[0].length, -fenceEnd[0].length).trim();
  }
  return trimmed;
}
function findJsonInText(text) {
  const trimmed = text.trim();
  if (!trimmed)
    return null;
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace === -1)
    return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = firstBrace;i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"' && !escape) {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{")
        depth++;
      if (ch === "}")
        depth--;
      if (depth === 0) {
        return trimmed.slice(firstBrace, i + 1);
      }
    }
  }
  return null;
}
function validCompletionStatus(s) {
  return s === "DONE" || s === "DONE_WITH_CONCERNS" || s === "NEEDS_CONTEXT" || s === "BLOCKED";
}
var REQUIRED_FIELDS = {
  task: { skill: "string" },
  result: { taskId: "string", status: "string", content: "string" },
  error: { taskId: "string", errorType: "string", detail: "string" },
  status: { taskId: "string", phase: "string" },
  completion: { status: "string", summary: "string" }
};
function parseAgnesMessage(text) {
  const cleaned = stripCodeFences(text);
  const jsonCandidate = findJsonInText(cleaned);
  if (!jsonCandidate)
    return null;
  let parsed;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object")
    return null;
  const obj = parsed;
  if (typeof obj.type !== "string" || !VALID_TYPES.has(obj.type))
    return null;
  if (typeof obj.id !== "string")
    return null;
  if (typeof obj.timestamp !== "string")
    return null;
  const type = obj.type;
  const required = REQUIRED_FIELDS[type];
  if (required) {
    for (const [field, expectedType] of Object.entries(required)) {
      if (typeof obj[field] !== expectedType)
        return null;
    }
    if (type === "completion" || type === "result") {
      if (!validCompletionStatus(obj.status))
        return null;
    }
  }
  return obj;
}
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
    if (parts.length > 0)
      line += `
Struggle: ${parts.join(", ")}`;
  }
  return line;
}
function getNextPlanId(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    return "plan-001";
  const cache = path.join(root, AGNES_DIR, PLANS_DIR);
  fs.mkdirSync(cache, { recursive: true });
  let max = 0;
  try {
    const files = fs.readdirSync(cache);
    for (const f of files) {
      const match = f.match(/^plan-(\d+)\.md$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max)
          max = num;
      }
    }
  } catch {}
  return `plan-${String(max + 1).padStart(3, "0")}`;
}
function writePlanFile(root, id, content) {
  const file = `${id}.md`;
  const filePath = path.join(root, AGNES_DIR, PLANS_DIR, file);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, filePath);
  return file;
}
function createPlanIteration(input) {
  const root = input.projectRoot ?? findProjectRoot();
  if (!root)
    throw new Error("Cannot create plan iteration: no project root found");
  const now = new Date().toISOString();
  const id = getNextPlanId(root);
  const total = (input.tasksMarkdown.match(/^- \[.?\]/gm) || []).length;
  let content = `---
id: ${id}
createdAt: ${now}
updatedAt: ${now}
parent: ${input.parent}
---

Goal: ${input.goal}

Check: ${input.check}

Tasks:
${input.tasksMarkdown}

${input.notes && input.notes.length > 0 ? `Notes:
${input.notes.map((n) => `- ${n}`).join(`
`)}

` : ""}Next:
- <first executable action>
`;
  const file = writePlanFile(root, id, content);
  const index = readPlanIndex(root);
  if (!index)
    throw new Error("Cannot create plan iteration: no index found");
  const parentEntry = index.plans.find((p) => p.id === input.parent);
  const carryAttempts = input.attempts ?? parentEntry?.attempts ?? 0;
  const carryStruggle = input.struggle ?? parentEntry?.struggle;
  const entry = {
    id,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    parent: input.parent,
    summary: input.summary,
    total,
    completed: input.completed,
    blocked: input.blocked,
    file,
    attempts: carryAttempts,
    ...carryStruggle ? { struggle: carryStruggle } : {}
  };
  if (parentEntry && !["done", "abandoned"].includes(parentEntry.status)) {
    parentEntry.status = "abandoned";
    parentEntry.updatedAt = now;
  }
  index.plans.push(entry);
  index.updatedAt = now;
  if (input.status === "done" || input.status === "abandoned") {
    index.activePlanId = null;
  } else {
    index.activePlanId = id;
  }
  writePlanIndex(index, root);
  return { entry, content };
}
function updatePlanStatus(input) {
  const root = input.projectRoot ?? findProjectRoot();
  if (!root)
    return null;
  const index = readPlanIndex(root);
  if (!index)
    return null;
  const entry = index.plans.find((p) => p.id === input.id);
  if (!entry)
    return null;
  const now = new Date().toISOString();
  entry.status = input.status;
  entry.updatedAt = now;
  if (input.completed !== undefined)
    entry.completed = input.completed;
  if (input.blocked !== undefined)
    entry.blocked = input.blocked;
  if (input.attempts !== undefined)
    entry.attempts = input.attempts;
  if (input.struggle !== undefined)
    entry.struggle = input.struggle;
  index.updatedAt = now;
  if (input.status === "done" || input.status === "abandoned") {
    if (index.activePlanId === input.id)
      index.activePlanId = null;
  }
  if (input.status === "draft" || input.status === "reviewed" || input.status === "ready" || input.status === "in_progress" || input.status === "blocked") {
    index.activePlanId = input.id;
  }
  writePlanIndex(index, root);
  return entry;
}
var PROMISE_TAG_PATTERN = /<promise>\s*(\S+)\s*<\/promise>/i;
function extractPromiseTag(text) {
  const msg = parseAgnesMessage(text);
  if (msg?.type === "completion")
    return msg.status;
  if (msg?.type === "result")
    return msg.status;
  const match = text.match(PROMISE_TAG_PATTERN);
  if (match) {
    const tag = match[1].trim();
    const statuses = ["DONE", "DONE_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED"];
    if (statuses.includes(tag))
      return tag;
    return "DONE";
  }
  return null;
}
function freshStruggleMetrics() {
  return {
    noProgressIterations: 0,
    repeatedErrors: {},
    shortIterations: 0,
    lastPromiseTag: null
  };
}
function updateStruggleMetrics(current, events) {
  return {
    noProgressIterations: events.hadProgress ? 0 : current.noProgressIterations + 1,
    repeatedErrors: (() => {
      if (events.errors.length === 0)
        return current.repeatedErrors;
      const merged = { ...current.repeatedErrors };
      for (const e of events.errors) {
        const key = e.substring(0, 100);
        merged[key] = (merged[key] || 0) + 1;
      }
      return merged;
    })(),
    shortIterations: events.durationMs < 30000 ? current.shortIterations + 1 : 0,
    lastPromiseTag: events.promiseTag ?? current.lastPromiseTag
  };
}

// src/bootstrap.ts
var __dirname2 = path2.dirname(fileURLToPath(import.meta.url));
var packageRoot = path2.resolve(__dirname2, "../..");
var packageJsonPath = path2.join(packageRoot, "package.json");
var skillsDir = path2.resolve(__dirname2, "../skills");
var opencodePackageCache = path2.join(os2.homedir(), ".cache", "opencode", "packages");
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
  return `${staticContent}

<AGNES_PLAN_STATE>
${planSummary}
</AGNES_PLAN_STATE>`;
}

// src/runtime.ts
var MAX_RETRIES_BEFORE_BLOCK = 3;
var MAX_BLOCK_CHAIN = 3;
var sessions = new Map;
var MAX_SESSIONS = 200;
var SESSION_TTL_MS = 3600000;
function pruneSessions() {
  const now = Date.now();
  for (const [key, state] of sessions) {
    if (now - state.lastAccessed > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
  if (sessions.size > MAX_SESSIONS) {
    const entries = [...sessions.entries()];
    const toDelete = entries.slice(0, entries.length - MAX_SESSIONS);
    for (const [key] of toDelete) {
      sessions.delete(key);
    }
  }
}
function getSession(sessionId) {
  let s = sessions.get(sessionId);
  if (!s) {
    s = { attempts: 0, struggle: freshStruggleMetrics(), lastPromiseTag: null, lastAccessed: Date.now() };
    sessions.set(sessionId, s);
  } else {
    s.lastAccessed = Date.now();
    sessions.delete(sessionId);
    sessions.set(sessionId, s);
  }
  return s;
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
function recordAttempt(sessionId, promiseTag, projectRoot, completionPromise = "DONE") {
  const state = getSession(sessionId);
  const root = projectRoot ?? findProjectRoot();
  if (root) {
    const index = readPlanIndex(root);
    if (index?.activePlanId) {
      const activeEntry = index.plans.find((p) => p.id === index.activePlanId);
      if (activeEntry?.status === "blocked") {
        state.attempts++;
        return { attempt: state.attempts, completed: false, blocked: true };
      }
    }
  }
  const completed = promiseTag !== null && promiseTag === completionPromise;
  if (completed) {
    state.lastPromiseTag = promiseTag;
    state.attempts = 0;
    state.struggle = freshStruggleMetrics();
    pruneSessions();
    persistToPlan("done", 0, freshStruggleMetrics(), projectRoot);
    return { attempt: 0, completed: true };
  }
  state.attempts++;
  state.struggle = updateStruggleMetrics(state.struggle, {
    hadProgress: false,
    durationMs: 0,
    errors: [],
    promiseTag: null
  });
  if (state.attempts >= MAX_RETRIES_BEFORE_BLOCK) {
    autoBlockPlan(projectRoot, state.attempts, state.struggle);
    state.attempts = 0;
    state.struggle = freshStruggleMetrics();
    pruneSessions();
    return { attempt: MAX_RETRIES_BEFORE_BLOCK, completed: false, blocked: true };
  }
  persistToPlan("in_progress", state.attempts, state.struggle, projectRoot);
  return { attempt: state.attempts, completed: false };
}
function autoBlockPlan(projectRoot, attempts, struggle) {
  try {
    const root = projectRoot ?? findProjectRoot();
    if (!root)
      return;
    const active = getLatestActivePlan(root);
    if (!active)
      return;
    if (active.entry.blocked >= MAX_BLOCK_CHAIN) {
      createPlanIteration({
        parent: active.entry.id,
        summary: "Cascade abandon: blocked chain exceeded limit",
        goal: active.content.match(/^Goal:\s*(.+)$/m)?.[1] ?? "Unknown goal",
        check: active.content.match(/^Check:\s*(.+)$/m)?.[1] ?? "unknown check",
        tasksMarkdown: active.content.match(/Tasks:\n([\s\S]*?)(?:\n\n|$)/)?.[1]?.trim() ?? "- [ ] Unknown",
        status: "abandoned",
        completed: active.entry.completed,
        blocked: active.entry.blocked,
        attempts,
        struggle,
        projectRoot: root
      });
      return;
    }
    const goalMatch = active.content.match(/^Goal:\s*(.+)$/m);
    const checkMatch = active.content.match(/^Check:\s*(.+)$/m);
    const goal = goalMatch ? goalMatch[1] : "Unknown goal";
    const check = checkMatch ? checkMatch[1] : "unknown check";
    const tasksMatch = active.content.match(/Tasks:\n([\s\S]*?)(?:\n\n|$)/);
    const tasksMarkdown = tasksMatch ? tasksMatch[1].trim() : "- [ ] Unknown";
    createPlanIteration({
      parent: active.entry.id,
      summary: `Auto-blocked after ${attempts} failed attempts`,
      goal,
      check,
      tasksMarkdown,
      status: "blocked",
      completed: active.entry.completed,
      blocked: active.entry.blocked + 1,
      attempts,
      struggle,
      projectRoot: root
    });
  } catch {}
}
function persistToPlan(status, attempts, struggle, projectRoot) {
  try {
    const root = projectRoot ?? findProjectRoot();
    if (!root)
      return;
    const index = readPlanIndex(root);
    if (!index || !index.activePlanId)
      return;
    const activeEntry = index.plans.find((p) => p.id === index.activePlanId);
    if (!activeEntry)
      return;
    if (activeEntry.status === "blocked")
      return;
    updatePlanStatus({
      id: index.activePlanId,
      status,
      attempts,
      struggle,
      projectRoot: root
    });
  } catch {}
}
function buildExecutionContext(entry) {
  const lines = [];
  if (entry.attempts !== undefined && entry.attempts > 0) {
    lines.push(`Current attempt: ${entry.attempts + 1}`);
  }
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
  "bug",
  "broken",
  "fails",
  "error",
  "test",
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

// src/schema.ts
var SKILL_REGISTRY = new Map;

// src/plugin.ts
var __dirname3 = path3.dirname(fileURLToPath2(import.meta.url));
var skillsDir2 = path3.resolve(__dirname3, "../skills");
function extractAssistantText(parts) {
  return parts.filter((p) => p.type === "text" && typeof p.text === "string").map((p) => p.text).join(`
`);
}
var AgnesPlugin = async ({ client }) => {
  client.app.log({
    body: { service: "agnes", level: "info", message: "AGNES plugin loaded successfully" }
  });
  return {
    config: async (config) => {
      const paths = config.skills?.paths ? [...config.skills.paths] : [];
      if (!paths.includes(skillsDir2)) {
        paths.push(skillsDir2);
      }
      config.skills = config.skills || {};
      config.skills.paths = paths;
    },
    "experimental.chat.messages.transform": async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages?.length)
        return;
      const assistantMsgs = output.messages.filter((m) => m.info?.role === "assistant");
      if (assistantMsgs.length > 0) {
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
        const assistantText = extractAssistantText(lastAssistant.parts);
        if (assistantText) {
          const agnesMsg = parseAgnesMessage(assistantText);
          if (agnesMsg?.type === "completion" || agnesMsg?.type === "result") {
            recordAttempt(lastAssistant.info?.sessionID ?? "global", agnesMsg.status);
          } else {
            const promiseTag = extractPromiseTag(assistantText);
            recordAttempt(lastAssistant.info?.sessionID ?? "global", promiseTag);
          }
        }
      }
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
      } catch (err) {
        console.debug("agnes: state read failed \u2014", err);
      }
      let fullBootstrap = bootstrap + (planGate || "");
      if (execContext) {
        fullBootstrap += `

## Execution Context
${execContext}
`;
      }
      fullBootstrap += `

## Completion Protocol
When all tasks are complete, output this EXACT JSON (NOT markdown):
${serializeAgnesMessage({ type: "completion", id: randomUUID(), timestamp: new Date().toISOString(), status: "DONE", summary: "all tasks completed successfully" })}
For partial results, use:
${serializeAgnesMessage({ type: "result", taskId: "task-000", id: randomUUID(), timestamp: new Date().toISOString(), status: "DONE", content: "...", artifact: {} })}
`;
      if (SKILL_REGISTRY.size > 0) {
        const schemaLines = [`
## Registered Skill Schemas`];
        for (const [name, desc] of SKILL_REGISTRY) {
          schemaLines.push(`- **${name}**: ${desc.description}`);
          schemaLines.push(`  Input schema: ${JSON.stringify(desc.inputSchema)}`);
          schemaLines.push(`  Output schema: ${JSON.stringify(desc.outputSchema)}`);
          schemaLines.push(`  Response format: ${desc.responseFormat}`);
        }
        fullBootstrap += `
` + schemaLines.join(`
`) + `
`;
      }
      const ref = firstUser.parts[0];
      firstUser.parts.unshift({
        id: randomUUID(),
        sessionID: ref.sessionID,
        messageID: ref.messageID,
        type: "text",
        text: fullBootstrap
      });
    }
  };
};
export {
  AgnesPlugin
};

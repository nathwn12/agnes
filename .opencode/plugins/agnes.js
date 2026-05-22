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
var OPENCODE_CACHE_ROOT = path.join(os.homedir(), ".cache", "opencode", "packages");
function isBlockedPath(dir) {
  const resolved = path.resolve(dir);
  const root = path.resolve(OPENCODE_CACHE_ROOT);
  if (os.platform() === "win32") {
    return resolved.toLowerCase().startsWith(root.toLowerCase());
  }
  return resolved.startsWith(root);
}
function findProjectRoot(startDir) {
  let dir = startDir ? path.resolve(startDir) : process.cwd();
  for (let i = 0;i < 20; i++) {
    if (isBlockedPath(dir))
      return null;
    if (fs.existsSync(path.join(dir, ".cache", "agnes", "index.json")))
      return dir;
    const parent = path.dirname(dir);
    if (parent === dir)
      return null;
    dir = parent;
  }
  return null;
}
function readPlanIndex(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    return null;
  const indexPath = path.join(root, ".cache", "agnes", "index.json");
  try {
    const raw = fs.readFileSync(indexPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function writePlanIndex(index, projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    throw new Error("Cannot write plan index: no project root found");
  const dir = path.join(root, ".cache", "agnes");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "index.json");
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}
function getLatestActivePlan(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  if (!root)
    return null;
  const index = readPlanIndex(root);
  if (!index)
    return null;
  const activeStatuses = ["draft", "in_progress", "blocked"];
  let target;
  if (index.activePlanId) {
    const entry = index.plans.find((p) => p.id === index.activePlanId);
    if (entry && activeStatuses.includes(entry.status)) {
      target = entry;
    }
  }
  if (!target) {
    const sorted = [...index.plans].filter((p) => activeStatuses.includes(p.status)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    target = sorted[0];
  }
  if (!target)
    return null;
  const planPath = path.join(root, ".cache", "agnes", target.file);
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
  if (input.status === "draft" || input.status === "in_progress" || input.status === "blocked") {
    index.activePlanId = input.id;
  }
  writePlanIndex(index, root);
  return entry;
}
var PROMISE_TAG_PATTERN = /<promise>\s*(\S+)\s*<\/promise>/i;
function extractPromiseTag(output) {
  const match = output.match(PROMISE_TAG_PATTERN);
  return match ? match[1] : null;
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
    repeatedErrors: events.errors.length === 0 ? {} : events.errors.reduce((acc, e) => {
      const key = e.substring(0, 100);
      acc[key] = (current.repeatedErrors[key] || 0) + 1;
      return acc;
    }, {}),
    shortIterations: events.durationMs < 30000 ? current.shortIterations + 1 : 0,
    lastPromiseTag: events.promiseTag ?? current.lastPromiseTag
  };
}
function extractErrorsFromOutput(output) {
  const errors = [];
  const lines = output.split(`
`);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("error:") || lower.includes("failed:") || lower.includes("exception:") || lower.includes("typeerror") || lower.includes("syntaxerror") || lower.includes("referenceerror") || lower.includes("test") && lower.includes("fail")) {
      const cleaned = line.trim().substring(0, 200);
      if (cleaned && !errors.includes(cleaned)) {
        errors.push(cleaned);
      }
    }
  }
  return errors.slice(0, 10);
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
function getStaticBootstrapContent() {
  const skillPath = path2.join(skillsDir, "ag-orchestrator", "SKILL.md");
  if (!fs2.existsSync(skillPath)) {
    return null;
  }
  const version = getPackageVersion();
  const skillStats = fs2.statSync(skillPath);
  const cacheKey = `${version}:${skillStats.mtimeMs}`;
  if (_bootstrapCache !== undefined && _bootstrapCache.key === cacheKey) {
    return _bootstrapCache.content;
  }
  const fullContent = fs2.readFileSync(skillPath, "utf8");
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
  const latestId = planIndex.plans.length > 0 ? [...planIndex.plans].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0].id : null;
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
    return "\n**PLAN REQUIRED:** No active plan found. Create a plan with `.cache/agnes/` before any implementation work.";
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
  lines.push("Output <promise>DONE</promise> when the task is genuinely complete.");
  return lines.join(`
`);
}

// src/plugin.ts
var __dirname3 = path3.dirname(fileURLToPath2(import.meta.url));
var skillsDir2 = path3.resolve(__dirname3, "../skills");
var sessionState = new Map;
var MAX_SESSION_ENTRIES = 200;
function pruneSessionState() {
  if (sessionState.size > MAX_SESSION_ENTRIES) {
    const entries = [...sessionState.entries()];
    const toDelete = entries.slice(0, entries.length - MAX_SESSION_ENTRIES);
    for (const [key] of toDelete) {
      sessionState.delete(key);
    }
  }
}
function persistExecutionToPlan(attempts, struggle) {
  try {
    const root = findProjectRoot();
    if (!root)
      return;
    const index = readPlanIndex(root);
    if (!index || !index.activePlanId)
      return;
    updatePlanStatus({
      id: index.activePlanId,
      status: "in_progress",
      attempts,
      struggle,
      projectRoot: root
    });
  } catch (err) {
    console.debug("agnes: plan persistence failed \u2014", err);
  }
}
function getSessionOrInit(sessionId) {
  let s = sessionState.get(sessionId);
  if (!s) {
    s = { attempts: 0, struggle: freshStruggleMetrics(), lastPromiseTag: null };
    sessionState.set(sessionId, s);
  }
  return s;
}
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
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir2)) {
        config.skills.paths.push(skillsDir2);
      }
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
          const promiseTag = extractPromiseTag(assistantText);
          const sessionId = lastAssistant.info?.sessionID ?? "global";
          const state = getSessionOrInit(sessionId);
          if (promiseTag) {
            state.lastPromiseTag = promiseTag;
            state.attempts = 0;
            state.struggle = freshStruggleMetrics();
            pruneSessionState();
            persistExecutionToPlan(0, freshStruggleMetrics());
          } else {
            state.attempts++;
            const errors = extractErrorsFromOutput(assistantText);
            const lower = assistantText.toLowerCase();
            const hadProgress = lower.includes("```diff") || lower.includes("file modified") || lower.includes("created:") || lower.includes("```") || !(lower.includes("no progress") || lower.includes("couldn't") || lower.includes("can't") || lower.includes("failed to") || lower.includes("was unable") || lower.includes("unable to") || lower.includes("error") && !lower.includes("not an error"));
            state.struggle = updateStruggleMetrics(state.struggle, {
              hadProgress,
              durationMs: 0,
              errors,
              promiseTag: null
            });
            persistExecutionToPlan(state.attempts, state.struggle);
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

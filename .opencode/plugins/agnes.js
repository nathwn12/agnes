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
  return `Active Plan: ${entry.id} (${entry.status}) \u2014 ${entry.completed}/${entry.total} tasks done
Goal: ${goal}
Latest update: ${entry.updatedAt}`;
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

// src/plugin.ts
var __dirname3 = path3.dirname(fileURLToPath2(import.meta.url));
var skillsDir2 = path3.resolve(__dirname3, "../skills");
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
      const firstUser = output.messages.find((m) => m.info?.role === "user");
      if (!firstUser || !firstUser.parts?.length)
        return;
      if (firstUser.parts.some((p) => p.type === "text" && typeof p.text === "string" && p.text.includes("EXTREMELY_IMPORTANT")))
        return;
      let planGate = "";
      try {
        const workspaceRoot = findProjectRoot();
        if (workspaceRoot) {
          planGate = getPlanGate(workspaceRoot) || "";
        }
      } catch (err) {
        console.debug("agnes: state read failed \u2014", err);
      }
      const fullBootstrap = bootstrap + (planGate || "");
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

// @bun
// src/plugin.ts
import { randomUUID } from "crypto";
import * as path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/bootstrap.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
var __dirname2 = path.dirname(fileURLToPath(import.meta.url));
var packageRoot = path.resolve(__dirname2, "../..");
var packageJsonPath = path.join(packageRoot, "package.json");
var skillsDir = path.resolve(__dirname2, "../skills");
var opencodePackageCache = path.join(os.homedir(), ".cache", "opencode", "packages");
function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match)
    return { content };
  return { content: match[2] };
}
function getPackageVersion() {
  if (!fs.existsSync(packageJsonPath))
    return "unknown";
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson.version || "unknown";
  } catch {
    return "unknown";
  }
}
var _bootstrapCache = undefined;
function getBootstrapContent() {
  const skillPath = path.join(skillsDir, "ag-orchestrator", "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    _bootstrapCache = undefined;
    return null;
  }
  const version = getPackageVersion();
  const skillStats = fs.statSync(skillPath);
  const cacheKey = `${version}:${skillStats.mtimeMs}`;
  if (_bootstrapCache !== undefined && _bootstrapCache.key === cacheKey) {
    return _bootstrapCache.content;
  }
  const fullContent = fs.readFileSync(skillPath, "utf8");
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
  const bootstrapContent = `<EXTREMELY_IMPORTANT>
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
  _bootstrapCache = { content: bootstrapContent, key: cacheKey };
  return bootstrapContent;
}

// src/state.ts
import * as fs2 from "fs";
import * as os2 from "os";
import * as path2 from "path";
var OPENCODE_CACHE_ROOT = path2.join(os2.homedir(), ".cache", "opencode", "packages");
function isBlockedPath(dir) {
  const resolved = path2.resolve(dir);
  const root = path2.resolve(OPENCODE_CACHE_ROOT);
  if (os2.platform() === "win32") {
    return resolved.toLowerCase().startsWith(root.toLowerCase());
  }
  return resolved.startsWith(root);
}
function findProjectRoot(startDir) {
  let dir = startDir ? path2.resolve(startDir) : process.cwd();
  for (let i = 0;i < 20; i++) {
    if (isBlockedPath(dir))
      return null;
    if (fs2.existsSync(path2.join(dir, ".cache", "agnes", "index.json")))
      return dir;
    const parent = path2.dirname(dir);
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
  const indexPath = path2.join(root, ".cache", "agnes", "index.json");
  try {
    const raw = fs2.readFileSync(indexPath, "utf8");
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
  const planPath = path2.join(root, ".cache", "agnes", target.file);
  try {
    const content = fs2.readFileSync(planPath, "utf8");
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

// src/runtime.ts
function getCurrentState(workspaceRoot) {
  if (workspaceRoot === undefined) {
    workspaceRoot = findProjectRoot();
  }
  if (!workspaceRoot)
    return null;
  const index = readPlanIndex(workspaceRoot);
  if (!index) {
    return {
      hasActivePlan: false,
      activePlanId: null,
      planContent: null,
      planEntry: null
    };
  }
  const active = getLatestActivePlan(workspaceRoot);
  if (!active) {
    return {
      hasActivePlan: false,
      activePlanId: null,
      planContent: null,
      planEntry: null
    };
  }
  return {
    hasActivePlan: true,
    activePlanId: active.entry.id,
    planContent: active.content,
    planEntry: active.entry
  };
}
function getPlanGateFromState(state) {
  if (!state.hasActivePlan) {
    return `
**PLAN REQUIRED:** No active plan found. Create a plan with \`.cache/agnes/\` before any implementation work.`;
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
      let planSummary = "";
      let planGate = "";
      try {
        const workspaceRoot = findProjectRoot();
        if (workspaceRoot) {
          planSummary = buildPlanSummary(workspaceRoot);
          const state = getCurrentState(workspaceRoot);
          if (state)
            planGate = getPlanGateFromState(state) || "";
        }
      } catch (err) {
        console.debug("agnes: state read failed \u2014", err);
      }
      const fullBootstrap = bootstrap + (planSummary ? `

` + planSummary : "") + (planGate || "");
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

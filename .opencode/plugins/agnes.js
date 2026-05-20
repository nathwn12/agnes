// @bun
// src/plugin.ts
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
  if (_bootstrapCache !== undefined)
    return _bootstrapCache;
  const skillPath = path.join(skillsDir, "ag-orchestrator", "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    _bootstrapCache = null;
    return null;
  }
  const fullContent = fs.readFileSync(skillPath, "utf8");
  const { content } = extractFrontmatter(fullContent);
  const bootstrapEnd = content.indexOf("<!-- bootstrap-end -->");
  const trimmedContent = bootstrapEnd !== -1 ? content.slice(0, bootstrapEnd).trim() : content;
  const version = getPackageVersion();
  const cacheNukeCommand = `Remove-Item -Recurse -Force "$env:USERPROFILE\\.cache\\opencode\\packages\\agnes@git+https_*"`;
  const toolMapping = `**Tool Mapping for OpenCode:**
When skills reference tools you don't have, substitute OpenCode equivalents:
- \`TodoWrite\` \u2192 \`todowrite\`
- \`Task\` with subagents \u2192 OpenCode's subagent system (@mention)
- \`Skill\` \u2192 OpenCode's native \`skill\` tool
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` \u2192 Your native tools

Use OpenCode's native \`skill\` tool to list and load skills.`;
  _bootstrapCache = `<EXTREMELY_IMPORTANT>
You are AGNES.

**Runtime Identity**
- Current AGNES version: \`${version}\`
- Installed AGNES package root: \`${packageRoot}\`
- Bundled AGNES skills directory: \`${skillsDir}\`
- OpenCode package cache root: \`${opencodePackageCache}\`
- If the user explicitly asks to clear or nuke AGNES's OpenCode cache, remove the installed AGNES cache directory or use: \`${cacheNukeCommand}\`, then restart OpenCode.

**IMPORTANT: The ag-orchestrator skill content is below. It is ALREADY LOADED. Do NOT use the skill tool to load "ag-orchestrator" again.**

${trimmedContent}

${toolMapping}
</EXTREMELY_IMPORTANT>`;
  return _bootstrapCache;
}

// src/state.ts
import * as fs2 from "fs";
import * as path2 from "path";
var _didBootstrapStateDir = false;
function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0;i < 20; i++) {
    if (fs2.existsSync(path2.join(dir, "package.json")) || fs2.existsSync(path2.join(dir, ".git")) || fs2.existsSync(path2.join(dir, ".opencode")))
      return dir;
    const parent = path2.dirname(dir);
    if (parent === dir)
      return null;
    dir = parent;
  }
  return null;
}
function findWorkspaceRoot() {
  let dir = process.cwd();
  for (let i = 0;i < 20; i++) {
    if (fs2.existsSync(path2.join(dir, "docs", "agnes")))
      return dir;
    const parent = path2.dirname(dir);
    if (parent === dir)
      return null;
    dir = parent;
  }
  return null;
}
function ensureStateDirectory() {
  if (_didBootstrapStateDir)
    return findWorkspaceRoot();
  _didBootstrapStateDir = true;
  const existing = findWorkspaceRoot();
  if (existing)
    return existing;
  const projectRoot = findProjectRoot();
  if (!projectRoot)
    return null;
  const agnesDir = path2.join(projectRoot, "docs", "agnes");
  fs2.mkdirSync(agnesDir, { recursive: true });
  return projectRoot;
}
function stateDir(workspaceRoot) {
  return path2.join(workspaceRoot, "docs", "agnes");
}
function listStateFiles(workspaceRoot) {
  const dir = stateDir(workspaceRoot);
  if (!fs2.existsSync(dir))
    return [];
  return fs2.readdirSync(dir).filter((f) => f.endsWith(".md"));
}
function readFrontmatter(workspaceRoot, name) {
  const filePath = path2.join(stateDir(workspaceRoot), name);
  if (!fs2.existsSync(filePath))
    return null;
  const fd = fs2.openSync(filePath, "r");
  const buffer = Buffer.alloc(4096);
  const bytesRead = fs2.readSync(fd, buffer, 0, 4096, 0);
  fs2.closeSync(fd);
  const head = buffer.toString("utf8", 0, bytesRead);
  const match = head.match(/^---\r?\n([\s\S]*?)\r?\n?---/);
  if (!match)
    return {};
  const result = {};
  for (const line of match[1].split(`
`)) {
    const sep = line.indexOf(":");
    if (sep > 0) {
      const key = line.slice(0, sep).trim();
      const val = line.slice(sep + 1).trim();
      if (key)
        result[key] = val;
    }
  }
  return result;
}
function getFileStatus(workspaceRoot, name) {
  const fm = readFrontmatter(workspaceRoot, name);
  if (!fm)
    return "active";
  return fm.status || "active";
}
function readStateFile(workspaceRoot, name) {
  const filePath = path2.join(stateDir(workspaceRoot), name);
  if (!fs2.existsSync(filePath))
    return null;
  return fs2.readFileSync(filePath, "utf8");
}
function getStateFileInjections() {
  const workspaceRoot = ensureStateDirectory();
  if (!workspaceRoot)
    return "";
  const files = listStateFiles(workspaceRoot);
  const goalStatus = getFileStatus(workspaceRoot, "goal.md");
  const handoffStatus = getFileStatus(workspaceRoot, "handoff.md");
  const hasGoal = files.includes("goal.md") && goalStatus === "active";
  const hasHandoff = files.includes("handoff.md") && handoffStatus === "active";
  const hasPlan = files.includes("plan.md") && getFileStatus(workspaceRoot, "plan.md") === "active";
  if (!hasGoal && !hasHandoff) {
    const agnesDir = stateDir(workspaceRoot);
    return `

## State directory ready

\`${agnesDir}\` created for this project. AGNES uses four files to track work across sessions:

| File | Purpose |
|------|---------|
| \`goal.md\` | One-sentence completion condition. Write first. |
| \`plan.md\` | Three-status checklist toward the goal. Write second. |
| \`handoff.md\` | Session state for another agent or later continuation. Write when stopping. |

See \`.opencode/skills/ag-orchestrator/SKILL.md\` \u2192 State Management for the full discipline.

**Start by writing your goal to \`docs/agnes/goal.md\`.**`;
  }
  if (hasHandoff) {
    const handoffContent = readStateFile(workspaceRoot, "handoff.md");
    if (handoffContent) {
      const handoffBlock = `## Active handoff

\`docs/agnes/handoff.md\` exists \u2014 you are receiving a handoff.

1. Read the handoff content below
2. Restore \`goal.md\` \u2014 copy the \`Goal:\` from handoff into \`docs/agnes/goal.md\`
3. Restore \`plan.md\` \u2014 write the \`## Pending\` items into \`docs/agnes/plan.md\` as \`[ ] pending\`
4. Delete \`docs/agnes/handoff.md\` \u2014 prevents reprocessing next session
5. Begin work \u2014 start with \`## Next\`

\`\`\`
${handoffContent}
\`\`\``;
      return `

` + handoffBlock;
    }
  }
  if (hasGoal) {
    const goalContent = readStateFile(workspaceRoot, "goal.md");
    if (goalContent) {
      const goalBlock = `## Active goal

\`docs/agnes/goal.md\` exists \u2014 you have an active goal. Re-read it before every delegation wave${hasPlan ? ", and check `docs/agnes/plan.md` for progress" : ""}.

\`\`\`
${goalContent}
\`\`\``;
      return `

` + goalBlock;
    }
  }
  return "";
}

// src/runtime.ts
function getCurrentState() {
  const workspaceRoot = findWorkspaceRoot();
  if (!workspaceRoot)
    return null;
  const files = listStateFiles(workspaceRoot);
  const goalActive = getFileStatus(workspaceRoot, "goal.md") === "active";
  const planActive = files.includes("plan.md") && getFileStatus(workspaceRoot, "plan.md") === "active";
  const handoffActive = getFileStatus(workspaceRoot, "handoff.md") === "active";
  return {
    hasGoal: goalActive,
    hasPlan: planActive,
    hasHandoff: handoffActive,
    goalContent: goalActive ? readStateFile(workspaceRoot, "goal.md") : null,
    planContent: planActive ? readStateFile(workspaceRoot, "plan.md") : null,
    handoffContent: handoffActive ? readStateFile(workspaceRoot, "handoff.md") : null
  };
}
function getPlanGate() {
  const state = getCurrentState();
  if (!state)
    return null;
  if (state.hasGoal && !state.hasPlan) {
    return `
**PLAN REQUIRED:** \`docs/agnes/plan.md\` does not exist but \`docs/agnes/goal.md\` does. Create \`docs/agnes/plan.md\` with a task checklist before any implementation work.`;
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
      const stateInjections = getStateFileInjections();
      const planGate = getPlanGate();
      const fullBootstrap = bootstrap + stateInjections + (planGate || "");
      const ref = firstUser.parts[0];
      firstUser.parts.unshift({
        ...ref,
        type: "text",
        text: fullBootstrap
      });
    }
  };
};
export {
  AgnesPlugin
};

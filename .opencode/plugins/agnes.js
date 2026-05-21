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
function findWorkspaceRoot() {
  let dir = process.cwd();
  for (let i = 0;i < 20; i++) {
    if (isBlockedPath(dir))
      return null;
    if (fs2.existsSync(path2.join(dir, "docs", "agnes")))
      return dir;
    const parent = path2.dirname(dir);
    if (parent === dir)
      return null;
    dir = parent;
  }
  return null;
}
function detectStateDirectory() {
  return findWorkspaceRoot();
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
var TEMPLATE_SIGNATURES = {
  "goal.md": [`# Goal

A goal is a`],
  "plan.md": [`# Plan

A three-status checklist`],
  "handoff.md": [`# Handoff

Saves session state`]
};
function isTemplateContent(workspaceRoot, name) {
  const filePath = path2.join(stateDir(workspaceRoot), name);
  if (!fs2.existsSync(filePath))
    return false;
  const content = fs2.readFileSync(filePath, "utf8");
  const stripped = content.replace(/^---[\s\S]*?---\r?\n?/, "");
  const normalized = stripped.replace(/\r\n/g, `
`);
  const signatures = TEMPLATE_SIGNATURES[name];
  if (!signatures)
    return false;
  return signatures.some((sig) => normalized.startsWith(sig));
}
function getFileStatus(workspaceRoot, name) {
  const fm = readFrontmatter(workspaceRoot, name);
  if (!fm)
    return "absent";
  if (fm.status && fm.status !== "active")
    return fm.status;
  if (isTemplateContent(workspaceRoot, name))
    return "template";
  return fm.status || "active";
}
function readStateFile(workspaceRoot, name) {
  const filePath = path2.join(stateDir(workspaceRoot), name);
  if (!fs2.existsSync(filePath))
    return null;
  return fs2.readFileSync(filePath, "utf8");
}
function buildStateInjectionStrings(workspaceRoot) {
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

\`${agnesDir}\` is initialized. AGNES uses three files to track work across sessions:

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
function getCurrentState(workspaceRoot) {
  if (workspaceRoot === undefined) {
    workspaceRoot = detectStateDirectory();
  }
  if (!workspaceRoot)
    return null;
  const files = listStateFiles(workspaceRoot);
  const goalActive = files.includes("goal.md") && getFileStatus(workspaceRoot, "goal.md") === "active";
  const planActive = files.includes("plan.md") && getFileStatus(workspaceRoot, "plan.md") === "active";
  const handoffActive = files.includes("handoff.md") && getFileStatus(workspaceRoot, "handoff.md") === "active";
  return {
    hasGoal: goalActive,
    hasPlan: planActive,
    hasHandoff: handoffActive,
    goalContent: goalActive ? readStateFile(workspaceRoot, "goal.md") : null,
    planContent: planActive ? readStateFile(workspaceRoot, "plan.md") : null,
    handoffContent: handoffActive ? readStateFile(workspaceRoot, "handoff.md") : null
  };
}
function getPlanGateFromState(state) {
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
      let stateInjections = "";
      let planGate = "";
      try {
        const workspaceRoot = detectStateDirectory();
        if (workspaceRoot) {
          stateInjections = buildStateInjectionStrings(workspaceRoot);
          const state = getCurrentState(workspaceRoot);
          if (state)
            planGate = getPlanGateFromState(state) || "";
        }
      } catch (err) {
        console.debug("agnes: state read failed \u2014", err);
      }
      const fullBootstrap = bootstrap + stateInjections + (planGate || "");
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

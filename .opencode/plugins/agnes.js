// @bun
// src/plugin.ts
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
var _didBootstrapStateDir = false;
function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0;i < 20; i++) {
    if (fs.existsSync(path.join(dir, "package.json")) || fs.existsSync(path.join(dir, ".git")) || fs.existsSync(path.join(dir, ".opencode")))
      return dir;
    const parent = path.dirname(dir);
    if (parent === dir)
      return null;
    dir = parent;
  }
  return null;
}
function findWorkspaceRoot() {
  let dir = process.cwd();
  for (let i = 0;i < 20; i++) {
    if (fs.existsSync(path.join(dir, "docs", "agnes")))
      return dir;
    const parent = path.dirname(dir);
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
  const agnesDir = path.join(projectRoot, "docs", "agnes");
  fs.mkdirSync(agnesDir, { recursive: true });
  return projectRoot;
}
function readStateFile(workspaceRoot, name) {
  const filePath = path.join(workspaceRoot, "docs", "agnes", name);
  if (!fs.existsSync(filePath))
    return null;
  return fs.readFileSync(filePath, "utf8");
}
function getStateFileInjections() {
  const workspaceRoot = ensureStateDirectory();
  if (!workspaceRoot)
    return "";
  const goalExists = fs.existsSync(path.join(workspaceRoot, "docs", "agnes", "goal.md"));
  const handoffExists = fs.existsSync(path.join(workspaceRoot, "docs", "agnes", "handoff.md"));
  const planExists = fs.existsSync(path.join(workspaceRoot, "docs", "agnes", "plan.md"));
  if (!goalExists && !handoffExists) {
    const agnesDir = path.join(workspaceRoot, "docs", "agnes");
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
  if (handoffExists) {
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
  if (goalExists) {
    const goalContent = readStateFile(workspaceRoot, "goal.md");
    if (goalContent) {
      const goalBlock = `## Active goal

\`docs/agnes/goal.md\` exists \u2014 you have an active goal. Re-read it before every delegation wave${planExists ? ", and check `docs/agnes/plan.md` for progress" : ""}.

\`\`\`
${goalContent}
\`\`\``;
      return `

` + goalBlock;
    }
  }
  return "";
}
var _bootstrapCache = undefined;
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
var AgnesPlugin = async ({ client }) => {
  client.app.log({
    body: { service: "agnes", level: "info", message: "AGNES plugin loaded successfully" }
  });
  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
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
      const fullBootstrap = bootstrap + stateInjections;
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

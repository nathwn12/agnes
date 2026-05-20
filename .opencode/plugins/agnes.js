// @bun
// src/plugin.ts
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
var __dirname2 = path.dirname(fileURLToPath(import.meta.url));
var skillsDir = path.resolve(__dirname2, "../skills");
function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match)
    return { content };
  return { content: match[2] };
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
  const toolMapping = `**Tool Mapping for OpenCode:**
When skills reference tools you don't have, substitute OpenCode equivalents:
- \`TodoWrite\` \u2192 \`todowrite\`
- \`Task\` with subagents \u2192 OpenCode's subagent system (@mention)
- \`Skill\` \u2192 OpenCode's native \`skill\` tool
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` \u2192 Your native tools

Use OpenCode's native \`skill\` tool to list and load skills.`;
  _bootstrapCache = `<EXTREMELY_IMPORTANT>
You are AGNES.

**IMPORTANT: The ag-orchestrator skill content is below. It is ALREADY LOADED. Do NOT use the skill tool to load "ag-orchestrator" again.**

${content}

${toolMapping}
</EXTREMELY_IMPORTANT>`;
  return _bootstrapCache;
}
var AgnesPlugin = async ({ client }) => {
  client.app.log({
    body: { service: "agnes", level: "info", message: "AGNES plugin loaded successfully" }
  });
  return {
    "experimental.chat.messages.transform": async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages?.length)
        return;
      const firstUser = output.messages.find((m) => m.info?.role === "user");
      if (!firstUser || !firstUser.parts?.length)
        return;
      if (firstUser.parts.some((p) => p.type === "text" && typeof p.text === "string" && p.text.includes("EXTREMELY_IMPORTANT")))
        return;
      const ref = firstUser.parts[0];
      firstUser.parts.unshift({
        ...ref,
        type: "text",
        text: bootstrap
      });
    }
  };
};
export {
  AgnesPlugin
};

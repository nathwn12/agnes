import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '../skills');

function extractFrontmatter(content: string): { content: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { content };
  return { content: match[2] };
}

let _bootstrapCache: string | null | undefined = undefined;

function getBootstrapContent(): string | null {
  if (_bootstrapCache !== undefined) return _bootstrapCache;

  const skillPath = path.join(skillsDir, 'ag-orchestrator', 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    _bootstrapCache = null;
    return null;
  }

  const fullContent = fs.readFileSync(skillPath, 'utf8');
  const { content } = extractFrontmatter(fullContent);

  const toolMapping = `**Tool Mapping for OpenCode:**
When skills reference tools you don't have, substitute OpenCode equivalents:
- \`TodoWrite\` → \`todowrite\`
- \`Task\` with subagents → OpenCode's subagent system (@mention)
- \`Skill\` → OpenCode's native \`skill\` tool
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` → Your native tools

Use OpenCode's native \`skill\` tool to list and load skills.`;

  _bootstrapCache = `<EXTREMELY_IMPORTANT>
You are AGNES.

**IMPORTANT: The ag-orchestrator skill content is below. It is ALREADY LOADED. Do NOT use the skill tool to load "ag-orchestrator" again.**

${content}

${toolMapping}
</EXTREMELY_IMPORTANT>`;

  return _bootstrapCache;
}

export const AgnesPlugin: Plugin = async ({ client }) => {
  client.app.log({
    body: { service: 'agnes', level: 'info', message: 'AGNES plugin loaded successfully' },
  });

  return {
    config: async (config: any) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];

      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
      }
    },

    'experimental.chat.messages.transform': async (_input, output: any) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages?.length) return;

      const firstUser = output.messages.find((m: any) => m.info?.role === 'user');
      if (!firstUser || !firstUser.parts?.length) return;

      if (firstUser.parts.some((p: any) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('EXTREMELY_IMPORTANT'))) return;

      const ref = firstUser.parts[0];
      firstUser.parts.unshift({
        ...ref,
        type: 'text',
        text: bootstrap,
      });
    },
  };
};

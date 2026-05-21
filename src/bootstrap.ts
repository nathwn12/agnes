import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlanSummary } from './state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const packageJsonPath = path.join(packageRoot, 'package.json');
const skillsDir = path.resolve(__dirname, '../skills');
const opencodePackageCache = path.join(os.homedir(), '.cache', 'opencode', 'packages');

function extractFrontmatter(content: string): { content: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { content };
  return { content: match[2] };
}

function getPackageVersion(): string {
  if (!fs.existsSync(packageJsonPath)) return 'unknown';

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

type BootstrapCacheEntry = {
  content: string | null;
  key: string;
};

let _bootstrapCache: BootstrapCacheEntry | undefined = undefined;

function getStaticBootstrapContent(): string | null {
  const skillPath = path.join(skillsDir, 'ag-orchestrator', 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    return null;
  }

  const version = getPackageVersion();
  const skillStats = fs.statSync(skillPath);
  const cacheKey = `${version}:${skillStats.mtimeMs}`;

  if (_bootstrapCache !== undefined && _bootstrapCache.key === cacheKey) {
    return _bootstrapCache.content;
  }

  const fullContent = fs.readFileSync(skillPath, 'utf8');
  const { content: frontmatterContent } = extractFrontmatter(fullContent);

  const bootstrapEnd = frontmatterContent.indexOf('<!-- bootstrap-end -->');
  const trimmedContent = bootstrapEnd !== -1 ? frontmatterContent.slice(0, bootstrapEnd).trim() : frontmatterContent;
  const cacheNukeCommand = `Remove-Item -Recurse -Force "$env:USERPROFILE\\.cache\\opencode\\packages\\agnes@git+https_*"`;

  const toolMapping = `**Tool Mapping for OpenCode:**
When skills reference tools you don't have, substitute OpenCode equivalents:
- \`TodoWrite\` → \`todowrite\`
- \`Task\` with subagents → OpenCode's subagent system (@mention)
- \`Skill\` → OpenCode's native \`skill\` tool
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` → Your native tools

Use OpenCode's native \`skill\` tool to list and load skills.`;

  const staticContent = `<EXTREMELY_IMPORTANT>
You are AGNES.

**Runtime Identity** (AGNES internal install paths — distinct from the current project workspace)
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

export function getBootstrapContent(): string | null {
  const staticContent = getStaticBootstrapContent();
  if (!staticContent) return null;

  const planSummary = buildPlanSummary(process.cwd());

  return `${staticContent}

<AGNES_PLAN_STATE>
${planSummary}
</AGNES_PLAN_STATE>`;
}

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const OPENCODE_CACHE_ROOT = path.join(os.homedir(), '.cache', 'opencode', 'packages');

function isBlockedPath(dir: string): boolean {
  const resolved = path.resolve(dir);
  const root = path.resolve(OPENCODE_CACHE_ROOT);
  if (os.platform() === 'win32') {
    return resolved.toLowerCase().startsWith(root.toLowerCase());
  }
  return resolved.startsWith(root);
}

function findProjectRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (isBlockedPath(dir)) return null;
    if (fs.existsSync(path.join(dir, 'package.json')) ||
        fs.existsSync(path.join(dir, '.git')) ||
        fs.existsSync(path.join(dir, '.opencode'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function findWorkspaceRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (isBlockedPath(dir)) return null;
    if (fs.existsSync(path.join(dir, 'docs', 'agnes'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/** Read-only detection — never creates directories, never side-effects. */
function detectStateDirectory(): string | null {
  return findWorkspaceRoot();
}

function stateDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'docs', 'agnes');
}

function listStateFiles(workspaceRoot: string): string[] {
  const dir = stateDir(workspaceRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md'));
}

function readFrontmatter(workspaceRoot: string, name: string): Record<string, string> | null {
  const filePath = path.join(stateDir(workspaceRoot), name);
  if (!fs.existsSync(filePath)) return null;

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(4096);
  const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
  fs.closeSync(fd);

  const head = buffer.toString('utf8', 0, bytesRead);
  const match = head.match(/^---\r?\n([\s\S]*?)\r?\n?---/);
  if (!match) return {};

  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep > 0) {
      const key = line.slice(0, sep).trim();
      const val = line.slice(sep + 1).trim();
      if (key) result[key] = val;
    }
  }
  return result;
}

const TEMPLATE_SIGNATURES: Record<string, string[]> = {
  'goal.md': ['# Goal\n\nA goal is a'],
  'plan.md': ['# Plan\n\nA three-status checklist'],
  'handoff.md': ['# Handoff\n\nSaves session state'],
};

function isTemplateContent(workspaceRoot: string, name: string): boolean {
  const filePath = path.join(stateDir(workspaceRoot), name);
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, 'utf8');
  const stripped = content.replace(/^---[\s\S]*?---\r?\n?/, '');
  const normalized = stripped.replace(/\r\n/g, '\n');

  const signatures = TEMPLATE_SIGNATURES[name];
  if (!signatures) return false;

  return signatures.some(sig => normalized.startsWith(sig));
}

function getFileStatus(workspaceRoot: string, name: string): string {
  const fm = readFrontmatter(workspaceRoot, name);
  if (!fm) return 'absent';
  if (fm.status && fm.status !== 'active') return fm.status;
  if (isTemplateContent(workspaceRoot, name)) return 'template';
  return fm.status || 'active';
}

function readStateFile(workspaceRoot: string, name: string): string | null {
  const filePath = path.join(stateDir(workspaceRoot), name);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function getStateFileInjections(): string {
  const workspaceRoot = detectStateDirectory();
  if (!workspaceRoot) return '';

  const files = listStateFiles(workspaceRoot);
  const goalStatus = getFileStatus(workspaceRoot, 'goal.md');
  const handoffStatus = getFileStatus(workspaceRoot, 'handoff.md');
  const hasGoal = files.includes('goal.md') && goalStatus === 'active';
  const hasHandoff = files.includes('handoff.md') && handoffStatus === 'active';
  const hasPlan = files.includes('plan.md') && getFileStatus(workspaceRoot, 'plan.md') === 'active';

  if (!hasGoal && !hasHandoff) {
    const agnesDir = stateDir(workspaceRoot);
    return `\n\n## State directory ready

\`${agnesDir}\` is initialized. AGNES uses three files to track work across sessions:

| File | Purpose |
|------|---------|
| \`goal.md\` | One-sentence completion condition. Write first. |
| \`plan.md\` | Three-status checklist toward the goal. Write second. |
| \`handoff.md\` | Session state for another agent or later continuation. Write when stopping. |

See \`.opencode/skills/ag-orchestrator/SKILL.md\` → State Management for the full discipline.

**Start by writing your goal to \`docs/agnes/goal.md\`.**`;
  }

  if (hasHandoff) {
    const handoffContent = readStateFile(workspaceRoot, 'handoff.md');
    if (handoffContent) {
      const handoffBlock = `## Active handoff

\`docs/agnes/handoff.md\` exists — you are receiving a handoff.

1. Read the handoff content below
2. Restore \`goal.md\` — copy the \`Goal:\` from handoff into \`docs/agnes/goal.md\`
3. Restore \`plan.md\` — write the \`## Pending\` items into \`docs/agnes/plan.md\` as \`[ ] pending\`
4. Delete \`docs/agnes/handoff.md\` — prevents reprocessing next session
5. Begin work — start with \`## Next\`

\`\`\`
${handoffContent}
\`\`\``;
      return '\n\n' + handoffBlock;
    }
  }

  if (hasGoal) {
    const goalContent = readStateFile(workspaceRoot, 'goal.md');
    if (goalContent) {
      const goalBlock = `## Active goal

\`docs/agnes/goal.md\` exists — you have an active goal. Re-read it before every delegation wave${hasPlan ? ', and check \`docs/agnes/plan.md\` for progress' : ''}.

\`\`\`
${goalContent}
\`\`\``;
      return '\n\n' + goalBlock;
    }
  }

  return '';
}

export { getStateFileInjections, detectStateDirectory, findWorkspaceRoot, readStateFile, listStateFiles, readFrontmatter, getFileStatus };

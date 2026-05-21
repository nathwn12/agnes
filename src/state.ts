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

// --- Internal: single-read per-file helper ---

interface FileData {
  content: string;
  frontmatter: Record<string, string>;
  status: string;
}

const TEMPLATE_SIGNATURES: Record<string, string[]> = {
  'goal.md': ['# Goal\n\nA goal is a'],
  'plan.md': ['# Plan\n\nA three-status checklist'],
  'handoff.md': ['# Handoff\n\nSaves session state'],
};

function getTemplateStatus(body: string, name: string): string | null {
  const signatures = TEMPLATE_SIGNATURES[name];
  if (!signatures) return null;
  const normalized = body.replace(/\r\n/g, '\n');
  return signatures.some(sig => normalized.startsWith(sig)) ? 'template' : null;
}

function loadFileData(workspaceRoot: string, name: string): FileData | null {
  const filePath = path.join(stateDir(workspaceRoot), name);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n?---/);

  if (!match) {
    const status = getTemplateStatus(content, name) || 'active';
    return { content, frontmatter: {}, status };
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep > 0) {
      const key = line.slice(0, sep).trim();
      const val = line.slice(sep + 1).trim();
      if (key) frontmatter[key] = val;
    }
  }

  const body = content.slice(match[0].length).replace(/^\r?\n/, '');
  const status = frontmatter.status && frontmatter.status !== 'active'
    ? frontmatter.status
    : (getTemplateStatus(body, name) || frontmatter.status || 'active');

  return { content, frontmatter, status };
}

// --- Public API (backward-compatible signatures) ---

function readFrontmatter(workspaceRoot: string, name: string): Record<string, string> | null {
  const data = loadFileData(workspaceRoot, name);
  return data ? data.frontmatter : null;
}

function getFileStatus(workspaceRoot: string, name: string): string {
  const data = loadFileData(workspaceRoot, name);
  return data ? data.status : 'absent';
}

function readStateFile(workspaceRoot: string, name: string): string | null {
  const data = loadFileData(workspaceRoot, name);
  return data ? data.content : null;
}

// --- Snapshot for multi-file consumers ---

export interface StateSnapshot {
  files: string[];
  goal: FileData | null;
  plan: FileData | null;
  handoff: FileData | null;
}

function getStateSnapshot(workspaceRoot: string): StateSnapshot {
  return {
    files: listStateFiles(workspaceRoot),
    goal: loadFileData(workspaceRoot, 'goal.md'),
    plan: loadFileData(workspaceRoot, 'plan.md'),
    handoff: loadFileData(workspaceRoot, 'handoff.md'),
  };
}

function buildStateInjectionStrings(workspaceRoot: string, snapshot?: StateSnapshot): string {
  const snap = snapshot ?? getStateSnapshot(workspaceRoot);
  const { files, goal, handoff, plan } = snap;

  const hasGoal = files.includes('goal.md') && goal?.status === 'active';
  const hasHandoff = files.includes('handoff.md') && handoff?.status === 'active';
  const hasPlan = files.includes('plan.md') && plan?.status === 'active';

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

  if (hasHandoff && handoff) {
    const handoffBlock = `## Active handoff

\`docs/agnes/handoff.md\` exists — you are receiving a handoff.

1. Read the handoff content below
2. Restore \`goal.md\` — copy the \`Goal:\` from handoff into \`docs/agnes/goal.md\`
3. Restore \`plan.md\` — write the \`## Pending\` items into \`docs/agnes/plan.md\` as \`[ ] pending\`
4. Delete \`docs/agnes/handoff.md\` — prevents reprocessing next session
5. Begin work — start with \`## Next\`

\`\`\`
${handoff.content}
\`\`\``;
    return '\n\n' + handoffBlock;
  }

  if (hasGoal && goal) {
    const goalBlock = `## Active goal

\`docs/agnes/goal.md\` exists — you have an active goal. Re-read it before every delegation wave${hasPlan ? ', and check \`docs/agnes/plan.md\` for progress' : ''}.

\`\`\`
${goal.content}
\`\`\``;
    return '\n\n' + goalBlock;
  }

  return '';
}

function getStateFileInjections(): string {
  const workspaceRoot = detectStateDirectory();
  if (!workspaceRoot) return '';
  return buildStateInjectionStrings(workspaceRoot);
}

export {
  getStateFileInjections,
  buildStateInjectionStrings,
  getStateSnapshot,
  detectStateDirectory,
  findWorkspaceRoot,
  readStateFile,
  listStateFiles,
  readFrontmatter,
  getFileStatus,
};

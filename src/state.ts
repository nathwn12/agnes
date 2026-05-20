import * as fs from 'node:fs';
import * as path from 'node:path';

let _didBootstrapStateDir = false;

function findProjectRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
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
    if (fs.existsSync(path.join(dir, 'docs', 'agnes'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function ensureStateDirectory(): string | null {
  if (_didBootstrapStateDir) return findWorkspaceRoot();
  _didBootstrapStateDir = true;

  const existing = findWorkspaceRoot();
  if (existing) return existing;

  const projectRoot = findProjectRoot();
  if (!projectRoot) return null;

  const agnesDir = path.join(projectRoot, 'docs', 'agnes');
  fs.mkdirSync(agnesDir, { recursive: true });
  return projectRoot;
}

function readStateFile(workspaceRoot: string, name: string): string | null {
  const filePath = path.join(workspaceRoot, 'docs', 'agnes', name);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function getStateFileInjections(): string {
  const workspaceRoot = ensureStateDirectory();
  if (!workspaceRoot) return '';

  const goalExists = fs.existsSync(path.join(workspaceRoot, 'docs', 'agnes', 'goal.md'));
  const handoffExists = fs.existsSync(path.join(workspaceRoot, 'docs', 'agnes', 'handoff.md'));
  const planExists = fs.existsSync(path.join(workspaceRoot, 'docs', 'agnes', 'plan.md'));

  if (!goalExists && !handoffExists) {
    const agnesDir = path.join(workspaceRoot, 'docs', 'agnes');
    return `\n\n## State directory ready

\`${agnesDir}\` created for this project. AGNES uses four files to track work across sessions:

| File | Purpose |
|------|---------|
| \`goal.md\` | One-sentence completion condition. Write first. |
| \`plan.md\` | Three-status checklist toward the goal. Write second. |
| \`handoff.md\` | Session state for another agent or later continuation. Write when stopping. |

See \`.opencode/skills/ag-orchestrator/SKILL.md\` → State Management for the full discipline.

**Start by writing your goal to \`docs/agnes/goal.md\`.**`;
  }

  if (handoffExists) {
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

  if (goalExists) {
    const goalContent = readStateFile(workspaceRoot, 'goal.md');
    if (goalContent) {
      const goalBlock = `## Active goal

\`docs/agnes/goal.md\` exists — you have an active goal. Re-read it before every delegation wave${planExists ? ', and check \`docs/agnes/plan.md\` for progress' : ''}.

\`\`\`
${goalContent}
\`\`\``;
      return '\n\n' + goalBlock;
    }
  }

  return '';
}

export { getStateFileInjections, findWorkspaceRoot, readStateFile };

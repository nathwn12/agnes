---
name: ag-shipper
description: Delivery workflow — presents options (merge, PR, keep, discard) and executes the chosen path with cleanup and safety guards
---

## Phase: SHIP

Use when: all code is written, tested, reviewed, and verified — ready to ship.

## Process

### 1. Verify Tests Pass

**Mandatory before offering any options.** Run the test suite. If tests fail, do NOT offer ship options — go back to fix.

### 2. Detect Environment

Determine current environment:
- **Normal repo**: `git rev-parse --git-dir` returns `.git`
- **Worktree**: `git rev-parse --git-common-dir` differs from `--git-dir`
- **Detached HEAD**: `git symbolic-ref -q HEAD` returns nothing

### 3. Determine Base Branch

Default: `main` or `master`. Check which exists.

### 4. Present Options

Offer these 4 options to the user:

| # | Option | When to Use |
|---|--------|-------------|
| 1 | Merge back to base branch locally | Feature complete, single developer |
| 2 | Push and create a Pull Request | Team project, needs review |
| 3 | Keep the branch as-is | Work in progress, not ready to ship |
| 4 | Discard this work | Wrong approach, experiment failed |

### 5. Execute Choice

**Option 1 — Merge locally:**
1. `git checkout <base-branch> && git pull`
2. `git merge <feature-branch>`
3. Run tests again
4. Clean up worktree if applicable
5. Delete feature branch

**Option 2 — Push and create PR:**
1. `git push -u origin <feature-branch>`
2. `gh pr create --base <base-branch> --title "<title>" --body "<structured body>"`
3. Return the PR URL to the user

**Option 3 — Keep branch:**
1. Note the branch name for future reference
2. No further action

**Option 4 — Discard:**
1. Require typed confirmation: user must type "discard" verbatim
2. `git branch -D <feature-branch>` (local only)
3. Clean up worktree if applicable

## Safety Rules

- Never force-push without explicit user request
- Never delete branches without confirmation
- Require typed "discard" confirmation for destructive operations
- Only clean up worktrees that AGNES created (track in session state)
- Verify tests pass BEFORE offering ship options
- If base branch has diverged significantly, alert the user before merging

## PR Body Template

```markdown
## Description
[What this PR does]

## Related Issues
Closes #[issue]

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing complete

## Checklist
- [ ] Code follows project conventions
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG updated
```

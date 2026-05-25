---
id: shipper
name: shipper
description: 'All code is written, tested, reviewed, and verified — ready to ship.'
phase: "SHIP"
use_when: "All code is written, tested, reviewed, and verified — ready to ship. Also when implementation is complete and you need to decide how to integrate the work."
version: 1.1
---

## Use When

- All code is written, tested, reviewed, and verified
- Implementation is complete, tests pass, need to decide integration method

## Core Concept

Assess change magnitude first, then route to the right delivery path. **Major changes → PR. Minor fixes → push direct.** When the user needs to decide how to integrate, present 4 structured options (merge, PR, keep, discard). Always get approval. Never skip verification.

## Precise Vocabulary

- **Worktree**: a git working tree linked to a repository, tracked separately from the main working directory
- **Detached HEAD**: HEAD points directly to a commit rather than a branch reference
- **Base branch**: the target branch for merging, typically `main` or `master`
- **Feature branch**: the branch containing the work to be shipped
- **Major change**: new feature, breaking change, architecture change, large refactor, API change
- **Minor fix**: bug fix, docs update, dependency bump, version bump, config change, small refactor
- **Merge locally**: integrate feature branch into base branch without a PR
- **Discard**: permanently delete the branch and associated worktree

## Context Requirements

- A git repository with a feature branch containing the completed work
- Tests have passed, code has been reviewed and verified
- Session state tracking which worktrees AGNES created

## Workflow

### 1. Verify Tests Pass

**Mandatory before shipping anything.** Run the test suite. If tests fail, do NOT proceed.

### 2. Detect Environment

Determine current environment:
- **Normal repo**: `git rev-parse --git-dir` returns `.git`
- **Worktree**: `--git-common-dir` differs from `--git-dir`
- **Detached HEAD**: `git symbolic-ref -q HEAD` returns nothing

### 3. Determine Base Branch

Default: `main` or `master`. Check which exists.

### 4. Branch Finishing (Interactive Decision)

When the user needs to decide how to integrate completed work, use this structured menu. Announce: "I'm using the finishing-a-development-branch workflow."

**Normal repo & named-branch worktree — 4 options:**
```
Implementation complete. What would you like to do?
1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is
4. Discard this work
```

**Detached HEAD — 3 options:** Options 2-4 only (no merge).

Wait for user selection, then route to the matching execution route below. If the user explicitly asks to ship/deploy (not choose), skip this step and go to Shelf-Check.

### 5. Shelf-Check

Before shipping, inspect the working tree:
1. **`.gitignore` exists?** — Warn if missing (non-blocking)
2. **Tracked vs untracked files** — Run `git status --porcelain`. Classify every entry.
3. **Exclusion check** — Scan for secrets, credentials, build artifacts in untracked files
4. **Report** — Present compact summary: *"These look correct to ship?"*
5. **Act** — Update `.gitignore` if user flags exclusions

### 6. Assess Change Magnitude

Analyze the diff to classify:

**Major** (→ PR route): new feature, breaking API change, architecture rewrite, large refactor (>500 lines), dependency changes, schema changes
**Minor** (→ Push direct route): bug fix, small refactor, docs, config, version bump, dependency bump, test additions, formatting

Default to **Minor** when uncertain. Present assessment with rationale. Let user override.

### 7. Execute Delivery

#### Route A: Minor Fix — Push Direct

1. **Ask user approval** — present the plan: version bump, docs update, commit, push
2. **Version bump** — semver: `fix` type → patch, `feat` type → minor, breaking → major
3. **Update docs** — README, CHANGELOG, any docs referencing changed code
4. **Conventional commit** — `<type>(<scope>): <description>`
5. **Push** to current branch

#### Route B: Major Change — Pull Request

1. **Ask user approval** — present the plan: push branch, create PR
2. `git push -u origin <feature-branch>`
3. `gh pr create --base <base-branch> --title "<title>" --body "<structured body>"`
4. Return the PR URL. **Do NOT clean up worktree** — user needs it for PR iteration.

#### Route C: Merge Locally

1. **Ask user approval** — merge into base branch, verify tests, cleanup
2. `cd` to main repo root (never inside the worktree being removed)
3. `git checkout <base-branch> && git pull && git merge <feature-branch>`
4. Verify tests pass on merged result
5. Cleanup worktree (Step 8), then `git branch -d <feature-branch>`

#### Route D: Keep / Discard

**Keep:** Note the branch name. No further action. Preserve worktree.

**Discard:** Require typed "discard" confirmation. List: branch name, commits, worktree path. On confirm: cleanup worktree (Step 8), then `git branch -D <feature-branch>`.

### 8. Cleanup Workspace

Only runs for Route C (Merge) and Route D (Discard). Routes B (PR) and Keep always preserve the worktree.

Detect environment:
- **Normal repo** (`GIT_DIR == GIT_COMMON`): No worktree to clean. Done.
- **Superpowers worktree** (path under `.worktrees/`, `worktrees/`, or `~/.config/superpowers/worktrees/`): AGNES owns cleanup. `cd` to main repo root, `git worktree remove <path>`, `git worktree prune`.
- **Harness-owned** (other path): Do NOT remove. The host environment owns this workspace.

## Tool Requirements

- **git**: for all local operations (checkout, merge, branch management, push)
- **gh** (GitHub CLI): for creating pull requests

## Output

| Route | Output |
|-------|--------|
| Minor — Push direct | Version bumped, docs updated, commit pushed with conventional message |
| Major — PR | Published PR URL |
| Merge locally | Branch merged into base, tests passed, worktree cleaned |
| Keep | Branch preserved, name noted |
| Discard | Branch deleted locally, worktree cleaned |

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

## Quality Criteria

- Always verify tests before any delivery
- Assess magnitude before choosing route; default Minor when uncertain
- Never skip version bump on push-direct (skip gracefully if no package.json)
- Always update CHANGELOG before push-direct
- Never force-push without explicit user request
- Never delete branches without typed confirmation
- Only clean up worktrees AGNES created (provenance check)
- Don't clean up worktree for PR or Keep routes
- `cd` to main repo root before any worktree removal
- Run `git worktree prune` after removal
- If base branch has diverged significantly, alert the user

## Common Mistakes

- **Skipping test verification** — verify tests before offering options or shipping
- **Open-ended questions** — always present structured options, not "what should I do?"
- **Cleaning up worktree for PR** — user needs it alive to iterate on feedback
- **Deleting branch before removing worktree** — `git branch -d` fails if worktree still references it. Merge first, remove worktree, then delete branch.
- **Running worktree remove from inside the worktree** — command fails silently. Always `cd` to main repo root first.
- **Cleaning up harness-owned worktrees** — only clean worktrees under `.worktrees/`, `worktrees/`, or `~/.config/superpowers/worktrees/`
- **No confirmation for discard** — require typed "discard" before deleting work

## When NOT to Use

- Tests are failing — go back to fix first
- Base branch has diverged significantly — alert user before proceeding
- Code has not been reviewed (for team projects where review is required)
- Destructive operations without typed confirmation from the user
- Work is incomplete or experimental — use keep or continue developing

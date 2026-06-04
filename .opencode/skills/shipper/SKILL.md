---
id: shipper
name: shipper
description: 'All code is written, tested, reviewed, and verified — ready to ship.'
phase: "SHIP"
use_when: "All code is written, tested, reviewed, and verified — ready to ship. Also when implementation is complete and you need to decide how to integrate the work."
version: 1.1
---

## Use When

- All code written, tested, reviewed, verified
- Implementation complete, tests pass, need integration method

## Core Concept

Assess change magnitude, route to right delivery path. **Major changes → PR. Minor fixes → push direct.** When user needs to decide integration, present 4 structured options (merge, PR, keep, discard). Always get approval. Never skip verification.

## Precise Vocabulary

- **Worktree**: git working tree linked to repo, tracked separately from main working directory
- **Detached HEAD**: HEAD points directly to commit, not branch
- **Base branch**: target for merging, typically `main` or `master`
- **Feature branch**: branch containing work to ship
- **Major change**: new feature, breaking change, architecture change, large refactor, API change
- **Minor fix**: bug fix, docs, dependency/version bump, config change, small refactor
- **Merge locally**: integrate feature branch into base without PR
- **Discard**: permanently delete branch and associated worktree

## Context Requirements

- Git repo with feature branch containing completed work
- Tests passed, code reviewed and verified
- Session state tracking which worktrees AGNES created

## Workflow

### 1. Verify Tests Pass

**Mandatory.** Run test suite. If tests fail, do NOT proceed.

### 2. Detect Environment

- **Normal repo**: `git rev-parse --git-dir` returns `.git`
- **Worktree**: `--git-common-dir` differs from `--git-dir`
- **Detached HEAD**: `git symbolic-ref -q HEAD` returns nothing

### 3. Determine Base Branch

Default: `main` or `master`. Check which exists.

### 4. Branch Finishing (Interactive Decision)

When user needs to decide integration, announce: "I'm using finishing-a-development-branch workflow."

**Normal repo & named-branch worktree — 4 options:**
```
Implementation complete. What would you like to do?
1. Merge back to <base-branch> locally
2. Push and create Pull Request
3. Keep branch as-is
4. Discard this work
```

**Detached HEAD — 3 options:** Options 2-4 only.

Wait for selection, route to execution. If user explicitly asks to ship/deploy (not choose), skip to Shelf-Check.

### 5. Shelf-Check

Before shipping:
1. **`.gitignore` exists?** — Warn if missing (non-blocking)
2. **Tracked vs untracked** — `git status --porcelain`. Classify every entry.
3. **Exclusion check** — Scan for secrets, credentials, build artifacts in untracked files
4. **Report** — Compact summary: *"These look correct to ship?"*
5. **Act** — Update `.gitignore` if user flags exclusions

### 6. Assess Change Magnitude

**Major** (→ PR): new feature, breaking API, architecture rewrite, large refactor (>500 lines), dependency changes, schema changes
**Minor** (→ Push direct): bug fix, small refactor, docs, config, version/dependency bump, test additions, formatting

Default **Minor** when uncertain. Present with rationale. Let user override.

### 7. Execute Delivery

#### Route A: Minor Fix — Push Direct

1. **Ask approval** — present plan: version bump, docs, commit, push
2. **Version bump** — semver: `fix` → patch, `feat` → minor, breaking → major
3. **Update docs** — README, CHANGELOG, any docs referencing changed code
4. **Conventional commit** — `<type>(<scope>): <description>`
5. **Push** to current branch

#### Route B: Major Change — Pull Request

1. **Ask approval** — plan: push branch, create PR
2. `git push -u origin <feature-branch>`
3. `gh pr create --base <base-branch> --title "<title>" --body "<structured body>"`
4. Return PR URL. **Do NOT clean up worktree** — user needs it for PR iteration.

#### Route C: Merge Locally

1. **Ask approval** — merge into base, verify tests, cleanup
2. `cd` to main repo root (never inside worktree being removed)
3. `git checkout <base-branch> && git pull && git merge <feature-branch>`
4. Verify tests pass on merged result
5. Cleanup worktree (Step 8), then `git branch -d <feature-branch>`

#### Route D: Keep / Discard

**Keep:** Note branch name. No further action. Preserve worktree.

**Discard:** Require typed "discard" confirmation. List: branch name, commits, worktree path. On confirm: cleanup worktree (Step 8), then `git branch -D <feature-branch>`.

### 8. Cleanup Workspace

Only runs for Route C (Merge) and Route D (Discard). Routes B (PR) and Keep preserve worktree.

- **Normal repo** (`GIT_DIR == GIT_COMMON`): No worktree to clean.
- **Superpowers worktree** (under `.worktrees/`, `worktrees/`, or `~/.config/superpowers/worktrees/`): AGNES owns cleanup. `cd` to main repo root, `git worktree remove <path>`, `git worktree prune`.
- **Harness-owned** (other path): Do NOT remove.

## Tool Requirements

- **git**: Checkout, merge, branch management, push
- **gh** (GitHub CLI): Creating pull requests

## Output

| Route | Output |
|-------|--------|
| Minor — Push direct | Version bumped, docs updated, conventional commit pushed |
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

- Verify tests before any delivery
- Assess magnitude before choosing route; default Minor when uncertain
- Never skip version bump on push-direct (skip gracefully if no package.json)
- Always update CHANGELOG before push-direct
- Never force-push without explicit request
- Never delete branches without typed confirmation
- Only clean worktrees AGNES created (provenance check)
- Don't clean worktree for PR or Keep routes
- `cd` to main repo root before worktree removal
- Run `git worktree prune` after removal
- If base branch diverged significantly, alert user

## Common Mistakes

- **Skipping test verification** — verify before offering options or shipping
- **Open-ended questions** — always present structured options
- **Cleaning worktree for PR** — user needs it alive for feedback iteration
- **Deleting branch before removing worktree** — `git branch -d` fails if worktree references it. Merge first, remove worktree, then delete.
- **Running worktree remove from inside worktree** — fails silently. Always `cd` to main repo root.
- **Cleaning harness-owned worktrees** — only clean under `.worktrees/`, `worktrees/`, `~/.config/superpowers/worktrees/`
- **No confirmation for discard** — require typed "discard" before deleting

## When NOT to Use

- Tests failing — fix first
- Base branch diverged significantly — alert user before proceeding
- Code not reviewed (team projects requiring review)
- Destructive operations without typed confirmation
- Work incomplete or experimental — use keep or continue developing

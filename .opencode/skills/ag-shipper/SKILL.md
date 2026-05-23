---
id: ag-shipper
phase: "SHIP"
use_when: "All code is written, tested, reviewed, and verified — ready to ship."
version: 1.0
---

## Use When

All code is written, tested, reviewed, and verified — ready to ship.

## Core Concept

Assess change magnitude first, then route to the right delivery path. **Major changes → PR. Minor fixes → push direct** (with version bump, docs update, conventional commit). Always get user approval before executing. Never skip verification.

## Precise Vocabulary

- **Worktree**: a git working tree linked to a repository, tracked separately from the main working directory
- **Detached HEAD**: HEAD points directly to a commit rather than a branch reference
- **Base branch**: the target branch for merging, typically `main` or `master`
- **Feature branch**: the branch containing the work to be shipped
- **Major change**: new feature, breaking change, architecture change, large refactor, API change
- **Minor fix**: bug fix, docs update, dependency bump, version bump, config change, small refactor

## Context Requirements

- A git repository with a feature branch containing the completed work
- Tests have passed, code has been reviewed and verified
- Session state tracking which worktrees AGNES created (for cleanup)

## Workflow

### 1. Verify Tests Pass

**Mandatory before shipping anything.** Run the test suite. If tests fail, do NOT ship — go back to fix.

### 2. Detect Environment

Determine current environment:
- **Normal repo**: `git rev-parse --git-dir` returns `.git`
- **Worktree**: `git rev-parse --git-common-dir` differs from `--git-dir`
- **Detached HEAD**: `git symbolic-ref -q HEAD` returns nothing

### 3. Determine Base Branch

Default: `main` or `master`. Check which exists.

### 4. Shelf-Check

Before shipping, inspect the working tree:

1. **`.gitignore` exists?** — Check `Test-Path .gitignore`. If missing, warn the user. Do not block, but flag it.
2. **Tracked vs untracked files** — Run `git status --porcelain`. Classify every entry:
   - `M ` / ` M` — modified tracked files (intended changes)
   - `A ` — added tracked files (intended)
   - `D ` — deleted tracked files (verify intentional)
   - `?? ` — untracked files (should these be tracked? ignored?)
   - `!` — ignored files (fine, skip)
3. **Exclusion check** — Scan untracked files for potential secrets/credentials/build artifacts that should be in `.gitignore`. Flag suspicious patterns: `.env`, `*.log`, `node_modules/`, `dist/`, credentials, keys, local config overrides.
4. **Report** — Present a compact summary to the user. Ask: *"These changes look correct to ship? Any files to exclude or add to .gitignore first?"*
5. **Act** — If user flags exclusions, update `.gitignore` before proceeding.

### 5. Assess Change Magnitude

Analyze the diff to classify the change:

**Major** (→ PR route): new feature, breaking API change, architecture rewrite, large refactor (>500 lines), dependency changes, schema changes
**Minor** (→ Push direct route): bug fix, small refactor, docs, config, version bump, dependency bump, test additions, formatting

Default to **Minor** when uncertain. Present your assessment to the user with a brief rationale. Let them override.

### 6. Execute Delivery

#### Route A: Minor Fix — Push Direct

1. **Ask user approval** — present the plan: version bump, docs update, commit, push
2. **Version bump** — update package.json (or equivalent) using semver:
   - `fix` type commit → patch bump (0.0.x)
   - `feat` type commit → minor bump (0.x.0)
   - breaking change → major bump (x.0.0)
3. **Update related docs** — in this order:
   - README.md (if feature/fix changed public API, setup, or usage)
   - CHANGELOG.md (always — append under `## [new-version] - YYYY-MM-DD`)
   - Any other docs that reference the changed code
4. **Stage and commit** with conventional commit message:
   ```
   <type>(<scope>): <description>

   [optional body]
   ```
5. **Push** to the current branch

#### Route B: Major Change — Pull Request

1. **Ask user approval** — present the plan: push branch, create PR
2. `git push -u origin <feature-branch>`
3. `gh pr create --base <base-branch> --title "<title>" --body "<structured body>"`
4. Return the PR URL to the user

#### Route C: Keep / Discard

Also offer these on request if the user doesn't want either route:

| Keep | Discard |
|------|---------|
| Note the branch name for future reference | Require typed "discard" confirmation |
| No further action | `git branch -D <feature-branch>` (local only) |
| | Clean up worktree if applicable |

## Tool Requirements

- **git**: for all local operations (checkout, merge, branch management, push)
- **gh** (GitHub CLI): for creating pull requests

## Output

| Route | Output |
|-------|--------|
| Minor — Push direct | Version bumped, docs updated, commit pushed with conventional message |
| Major — PR | Published PR URL |
| Keep | Branch preserved, name noted |
| Discard | Branch deleted locally |

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

- Always assess magnitude before choosing route
- Default Minor when uncertain — let user override up
- Never skip version bump on push-direct (check package.json exists first; if not, skip gracefully)
- Always update CHANGELOG before push-direct
- Never force-push without explicit user request
- Never delete branches without typed confirmation
- Require typed "discard" for destructive operations
- Only clean up worktrees AGNES created (track in session state)
- Verify tests pass BEFORE shipping
- If base branch has diverged significantly, alert the user

## When NOT to Use

- Tests are failing — go back to fix first
- Base branch has diverged significantly — alert user before proceeding
- Code has not been reviewed (for team projects where review is required)
- Destructive operations without typed confirmation from the user
- Work is incomplete or experimental — use keep or continue developing

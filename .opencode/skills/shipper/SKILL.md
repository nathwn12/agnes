---
id: shipper
name: shipper
description: 'All code is written, tested, reviewed, and verified — ready to ship.'
phase: "SHIP"
use_when: "All code is written, tested, reviewed, and verified — ready to ship. Also when implementation is complete and you need to decide how to integrate the work."
version: 1.1
---

# Shipper

## Tradeoff

Speed vs safety. Minor fixes → push direct (fast). Major changes → PR (reviewed). Always verify before ship. Never skip gates for speed.

## Core Concept

Assess change magnitude first, then route to right delivery path. **Major → PR. Minor → push direct.** Present 4 structured options (merge, PR, keep, discard). Always get approval. Never skip verification.

## Precise Vocabulary

- **Worktree**: git working tree linked to a repo, tracked separately from main working dir
- **Detached HEAD**: HEAD points to commit, not branch ref
- **Base branch**: target merge branch, typically `main`/`master`
- **Feature branch**: branch containing work to ship
- **Major change**: new feature, breaking change, arch change, large refactor, API change
- **Minor fix**: bug fix, docs, dep bump, version bump, config, small refactor
- **Merge locally**: integrate feature branch into base without PR
- **Discard**: permanently delete branch + associated worktree

## Context Requirements

- Git repo with feature branch containing completed work
- Tests passed, code reviewed and verified
- Session state tracking which worktrees AGNES created

## Workflow

### 1. Verify Tests Pass
`npm test` or equivalent.
→ verify: all tests pass
If tests fail → STOP. Return to fix.

### 2. Detect Environment
`git rev-parse --git-dir`, `--git-common-dir`, `git symbolic-ref -q HEAD`
→ verify: environment classified (normal / worktree / detached HEAD)

### 3. Determine Base Branch
Check `main` or `master` exists.
→ verify: base branch resolved

### 4. Branch Finishing (Interactive)
Normal repo / named-branch worktree — 4 options:
1. Merge back to `<base>` locally
2. Push + create PR
3. Keep branch as-is
4. Discard work

Detached HEAD — options 2-4 only.
If user explicitly asks to ship/deploy → skip to Shelf-Check.

### 5. Shelf-Check
1. `.gitignore` exists? Warn if missing (non-blocking)
2. `git status --porcelain` → classify every entry
3. Scan for secrets, credentials, build artifacts
4. Present: "These look correct to ship?"
5. Update `.gitignore` if flags raised
→ verify: workspace clean, no secrets

### 6. Assess Change Magnitude
Analyze diff:
- **Major** (→ PR): new feature, breaking API, arch rewrite, >500 lines, dep changes, schema changes
- **Minor** (→ Push direct): bug fix, small refactor, docs, config, version bump, dep bump, tests, formatting

Default **Minor** when uncertain. Present with rationale. User may override.
→ verify: magnitude classification correct

### 7. Execute Delivery

**Route A: Minor Fix — Push Direct**
1. Present plan (version bump, docs, commit, push) → get approval
2. Version bump: `fix` → patch, `feat` → minor, breaking → major
3. Update README + CHANGELOG + docs referencing changed code
4. Conventional commit: `<type>(<scope>): <description>`
5. `git push`
→ verify: version bumped, docs updated, commit pushed

**Route B: Major Change — PR**
1. Present plan (push branch, create PR) → get approval
2. `git push -u origin <feature-branch>`
3. `gh pr create --base <base> --title "<title>" --body "<body>"`
4. Return PR URL. Do NOT clean worktree — user needs it for iteration.
→ verify: PR created, URL returned

**Route C: Merge Locally**
1. Present plan (merge into base, verify tests, cleanup) → get approval
2. `git checkout <base> && git pull && git merge <feature-branch>`
3. Verify tests pass on merged result
4. Cleanup worktree, `git branch -d <feature-branch>`
→ verify: merged, tests pass, worktree cleaned

**Route D: Keep / Discard**
- Keep: Note branch name. No further action. Preserve worktree.
- Discard: Require typed "discard" confirmation. List branch, commits, worktree path. Cleanup worktree, `git branch -D <feature-branch>`.
→ verify: confirmed and executed

### 8. Cleanup Workspace
Only for Route C (Merge) and Route D (Discard). Routes B (PR) and Keep preserve worktree.

- **Normal repo** (`GIT_DIR == GIT_COMMON`): No worktree. Done.
- **Superpowers worktree** (`.worktrees/`, `worktrees/`, `~/.config/superpowers/worktrees/`): AGNES owns cleanup. `git worktree remove <path>; git worktree prune`
- **Harness-owned** (other path): Do NOT remove. Host owns this workspace.
→ verify: workspace clean

### Flow

```
[Verify Tests] → [Fail] → STOP, fix
     ↓ [Pass]
[Shelf-Check] → [Issues] → Fix gitignore
     ↓ [Clean]
[Assess Magnitude] → [Minor] → Push Direct
                   → [Major] → PR
                   → [Merge] → Merge Locally
                   → [Keep/Discard] → Done
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| `git` | All | repo state, branch info | verification, commits, merge |
| `gh` | Route B (PR) | branch, title, body | PR URL |
| `npm` | Route A (version) | `package.json` | bumped version |

## Examples

| Scenario | Lines | Magnitude | Route | Key Verify |
|----------|-------|-----------|-------|------------|
| Bug fix, 1 file | 3 | Minor | Push direct | Tests pass, CHANGELOG updated |
| New feature, 8 files | 800 | Major | PR | Tests pass, PR URL returned |
| Config change, 1 file | 5 | Minor | Push direct | Tests pass, config verified |
| API schema change | 200 | Major | PR | Tests pass, migration noted |
| Dep bump | 2 | Minor | Push direct | Lockfile updated, tests pass |

## Output

| Route | Output |
|-------|--------|
| Minor — Push direct | Version bumped, docs updated, conventional commit pushed |
| Major — PR | Published PR URL |
| Merge locally | Branch merged into base, tests pass, worktree cleaned |
| Keep | Branch preserved, name noted |
| Discard | Branch deleted, worktree cleaned |

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

→ verify: Tests pass before any delivery
→ verify: Magnitude assessed before route choice; default Minor when uncertain
→ verify: Version bump on push-direct (skip gracefully if no package.json)
→ verify: CHANGELOG updated before push-direct
→ verify: No force-push without explicit user request
→ verify: No branch deletion without typed confirmation
→ verify: Only clean worktrees AGNES created (provenance check)
→ verify: Worktree preserved for PR and Keep routes
→ verify: `cd` to main repo root before worktree removal
→ verify: `git worktree prune` after removal
→ verify: Alert user if base branch has diverged significantly

## Common Mistakes

- **Skipping test verification** — verify tests before offering options or shipping
- **Open-ended questions** — always present structured options, not "what should I do?"
- **Cleaning up worktree for PR** — user needs it alive to iterate
- **Deleting branch before removing worktree** — `git branch -d` fails if worktree references it
- **Running worktree remove from inside the worktree** — always `cd` to main repo root first
- **Cleaning up harness-owned worktrees** — only clean AGNES-owned paths
- **No confirmation for discard** — require typed "discard" before deleting

## Protocol Shells

```
/protocol {
  intent="Verify and ship completed work",
  input={ changes="<scope>", checks="<verification-gates>" },
  process=[ /verify{quality-gates}, /verify{regression}, /synthesize{readiness} ],
  output={ result="<ship-decision>", evidence="<gate-results>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /verify | Check each quality gate with explicit evidence |
| /synthesize | Combine gate results into ship/no-ship decision |
| /reflect | Self-critique readiness claim before final output |

## When NOT to Use

- Tests are failing — fix first
- Base branch diverged significantly — alert user
- Code not reviewed (team projects requiring review)
- Destructive operations without typed confirmation
- Work is incomplete/experimental — use Keep or continue developing

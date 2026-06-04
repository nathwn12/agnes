---
name: shipper
id: shipper
phase: SHIP
description: 'All code is written, tested, reviewed, and verified — ready to ship.'
---
## RULES
- Never skip test verification before any delivery
- Major (new feature, breaking API, rewrite, >500 lines) → PR
- Minor (bug fix, refactor, docs, config, version bump, tests) → Push direct
- Default Minor when uncertain
- Never skip version bump on push-direct
- Always update CHANGELOG before push-direct
- Never force-push without explicit request
- Never delete branches without typed "discard" confirmation
- Only clean worktrees AGNES created. Never harness-owned

## FLOW
1. Verify tests pass (mandatory, block if failing)
2. Detect environment: normal repo, worktree, detached HEAD
3. Determine base branch
4. Present options: Merge, Push+PR, Keep, Discard
5. Shelf-Check: .gitignore, classify tracked/untracked, scan secrets
6. Execute per route: Minor → version bump, docs, commit, push. Major → push, `gh pr create`. Merge → checkout base, pull, merge, verify, cleanup. Keep → note branch. Discard → confirm, cleanup
7. Cleanup workspace (Merge and Discard routes only)

## TRIGGERS
- All code written, tested, reviewed, verified
- Implementation complete, tests pass, need integration method

## NEXT
- documenter — document shipping decisions
- retro — reflect after shipping

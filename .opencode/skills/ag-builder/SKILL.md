---
name: ag-builder
description: Disciplined plan execution — creates isolated worktrees, dispatches subagents per task, and runs the verify-review-commit cycle
---

## Phase: BUILD

Use when: a plan has been reviewed and approved by ag-plan-reviewer, implementation is ready to start.

## Setup

1. **Detect or create isolated worktree**:
   - Check if currently in a worktree via `git rev-parse --git-common-dir`
   - If not in a worktree, create one: `git worktree add ../<feature-branch> <base-branch>`
   - Never work directly on main/master
2. **Install dependencies**: `bun install` or equivalent
3. **Verify clean baseline**: Tests pass before any changes

## Execution Loop (per task in plan)

For each task in the implementation plan:

### 1. Build

Write code for the task. Follow the spec exactly. Include complete code — no placeholders.

### 2. Test

Write and run tests for the change:
- Unit tests for new functions/components
- Integration tests for cross-module changes
- Verify existing tests still pass

### 3. Verify

Dispatch ag-verifier gate:
- Type check: `tsc --noEmit`
- Lint: `bun run lint` or equivalent
- Test: `bun run test` or equivalent
- Build: `bun run build` or equivalent
- Capture actual output as evidence

### 4. Review

Dispatch ag-reviewer for code quality:
- Spec compliance check
- Code quality check
- Fix any Critical or Important issues

### 5. Commit

Conventional commit message format:
```
<type>(<scope>): <description>

- <detail>
```

Types: feat, fix, refactor, test, docs, chore, style

## Subagent Dispatch

- Fresh subagent per task (isolated context, no carryover state)
- Implementer → verifier → reviewer pipeline per task
- Pass: task description, relevant file paths, skill instructions, acceptance criteria

## Worktree Management

- Create worktree at start, track the path
- Clean up worktrees when done (after merge or discard)
- Never run git commands that affect other branches without explicit intent
- If a worktree already exists, reuse it rather than creating a new one

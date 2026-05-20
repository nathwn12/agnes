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

The implementer returns one of four statuses after dispatch:

| Status | Meaning | Action |
|--------|---------|--------|
| DONE | Task complete, ready for review | Proceed to Verify → Review |
| DONE_WITH_CONCERNS | Complete but implementer flagged uncertainties | Surface concerns with evidence before proceeding |
| NEEDS_CONTEXT | Implementer couldn't proceed (missing info) | Provide missing context, re-dispatch |
| BLOCKED | External blocker (dep, permission, env) | Write `handoff.md`, stop |

On DONE_WITH_CONCERNS: review flagged concerns with the user before continuing. Do not silently skip.
On NEEDS_CONTEXT: identify the exact gap, fill it, re-dispatch the same task.
On BLOCKED: write handoff.md with Progress, Evidence, and Next sections. Then stop.

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

### 4. Review (Two-Stage)

Dispatch two separate review subagents. Never combine into one.

**Stage 1 — Spec Compliance:**
- Dispatch a spec-reviewer subagent
- Checks: does implementation match the plan/spec exactly?
- Verifies: all acceptance criteria met, no scope drift, no missing pieces
- If Stage 1 fails → fix issues → re-review Stage 1. Only then proceed to Stage 2.

**Stage 2 — Code Quality:**
- Dispatch a code-quality subagent
- Checks: tests exist and pass, types are correct, naming is consistent, patterns match codebase, no security issues, no performance regressions
- Fix any Critical or Important issues

### 5. Commit

Conventional commit message format:
```
<type>(<scope>): <description>

- <detail>
```

Types: feat, fix, refactor, test, docs, chore, style

## Subagent Dispatch

### Prompt Structure

Every subagent dispatch must include exactly these five fields:

| Field | Description |
|-------|-------------|
| Task description | Exact text from the plan |
| Relevant file paths | Paths to files the subagent needs (read-only access first) |
| Skill instructions | Which patterns, conventions, or skills to follow |
| Acceptance criteria | How to verify the task is done |
| Expected output format | What to return (diff, summary, status, concerns) |

### Model Selection

Choose the model based on work complexity:

| Work Type | Model Tier | Examples |
|-----------|-----------|---------|
| Mechanical | Cheapest/fastest | Simple edits, boilerplate, straightforward tests |
| Mid-tier | Medium cost/speed | Documentation, simple refactors, routine updates |
| Complex | Most capable | Architecture decisions, complex logic, security review |

Document which model was used per task in plan.md.

### Four Implementer Statuses

After each task dispatch, the implementer returns one of:

- **DONE** — task complete, proceed to Verify → Review
- **DONE_WITH_CONCERNS** — task complete but implementer flagged uncertainties. Surface concerns with evidence before continuing.
- **NEEDS_CONTEXT** — implementer couldn't proceed. Identify the exact missing context, provide it, re-dispatch.
- **BLOCKED** — external blocker. Write handoff.md (Progress / Evidence / Next). Stop.

### Parallel Task Dispatch

When tasks are independent (no shared state, no ordering requirement), dispatch multiple implementers simultaneously:

1. **Scan plan for dependency graph**: read all tasks, identify dependencies
2. **Independent tasks** → dispatch in parallel (separate subagents, simultaneous)
3. **Dependent tasks** → order by dependency chain
4. **While waiting** for dependent results, prepare context (files, specs, acceptance criteria) for the next wave

### When NOT to Parallelize

Do NOT parallelize when:

| Condition | Why |
|-----------|-----|
| Tasks share mutable state | Concurrent writes cause conflicts |
| One task produces artifacts another needs | Sequential by definition |
| First task informs second task's direction | Exploratory — second task depends on first task's findings |
| Combined context needed for coherence | Split context breaks consistency (e.g., cross-cutting refactors) |

When in doubt, run sequentially.

### Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|--------------|---------|-----|
| Too broad scope | Single task covers too much | Split into smaller, focused tasks |
| No context provided | Subagent has no codebase reference | Always include file paths and relevant code |
| No constraints | Subagent doesn't know what NOT to do | State boundaries: "don't touch X", "stay in Y module" |
| Vague output | Subagent doesn't know what to return | Always specify expected output format in prompt |

### Pipeline

- Fresh subagent per task (isolated context, no carryover state)
- Implementer → verifier → reviewer pipeline per task
- Pass: task description, relevant file paths, skill instructions, acceptance criteria

## Worktree Management

- Create worktree at start, track the path
- Clean up worktrees when done (after merge or discard)
- Never run git commands that affect other branches without explicit intent
- If a worktree already exists, reuse it rather than creating a new one

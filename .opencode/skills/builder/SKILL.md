---
id: builder
phase: "BUILD"
use_when: "A plan has been reviewed and approved by plan-reviewer, implementation is ready to start."
version: 1.0
---

## Use When

A plan has been reviewed and approved by plan-reviewer, implementation is ready to start.

## Core Concept

Disciplined plan execution that creates isolated worktrees, dispatches subagents per task, and runs the verify-review-commit cycle. Each task follows a Build → Test → Verify → Review → Commit pipeline with strict status reporting and parallel dispatch where dependencies allow.

## Precise Vocabulary

- **Worktree**: Isolated git working tree created via `git worktree add` to keep implementation separate from the base branch
- **Subagent dispatch**: Delegating a task to a separate agent with structured context (task description, file paths, skill instructions, acceptance criteria, expected output format)
- **DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED**: The four implementer statuses returned after task dispatch
- **Stage 1 (Spec Compliance)**: Checks implementation matches the plan/spec exactly
- **Stage 2 (Code Quality)**: Checks tests, types, naming, patterns, security, performance
- **Conventional commit**: Commit format `<type>(<scope>): <description>` with types feat, fix, refactor, test, docs, chore, style

## Context Requirements

- A reviewed and approved implementation plan must exist
- Plan tasks must be scoped to individual, independently dispatchable units
- Clean baseline with passing tests before any changes begin
- Dependencies installed (bun install or equivalent)

## Workflow

### Setup

1. **Detect or create isolated worktree**:
   - Check if currently in a worktree via `git rev-parse --git-common-dir`
   - If not in a worktree, create one: `git worktree add ../<feature-branch> <base-branch>`
   - Never work directly on main/master
2. **Install dependencies**: `bun install` or equivalent
3. **Verify clean baseline**: Tests pass before any changes

### Execution Loop (per task in plan)

For each task in the implementation plan:

#### 1. Build (Ralph Loop)

Write code for the task. Follow the spec exactly. Include complete code — no placeholders.

Dispatch the implementer using the **Ralph Loop** pattern — an iterative retry loop that sends the same prompt until the implementer signals completion via a `<promise>` tag:

```
For each task:
  1. Set default: maxRetries = 3, completionPromise = "DONE"
  2. For attempt = 1..maxRetries:
     a. Dispatch subagent with prompt that includes:
        - Task description from plan
        - Acceptance criteria
        - "Output <promise>${completionPromise}</promise> when truly complete"
     b. Scan subagent output for <promise>TAG</promise>
     c. If found with expected tag → proceed to Verify
     d. If not found and attempt < maxRetries → retry with same prompt
     e. Track struggle indicators per attempt:
        - No file changes → increment noProgress
        - Duration < 30s → increment shortIterations
        - Repeated error patterns → increment error count
  3. If maxRetries exhausted → return BLOCKED status
```

The implementer returns one of four statuses after dispatch:

| Status | Meaning | Action |
|--------|---------|--------|
| DONE | Task complete (promise detected), ready for review | Proceed to Verify → Review |
| DONE_WITH_CONCERNS | Promise detected but implementer flagged uncertainties | Surface concerns with evidence before proceeding |
| NEEDS_CONTEXT | Implementer couldn't proceed (missing info) | Provide missing context, re-dispatch |
| BLOCKED | External blocker or max retries exhausted | Create a new blocked plan iteration. Then stop. |

On DONE_WITH_CONCERNS: review flagged concerns with the user before continuing. Do not silently skip.
On NEEDS_CONTEXT: identify the exact gap, fill it, re-dispatch the same task.
On BLOCKED: Create a new blocked plan iteration. Then stop.

##### Struggle Detection

If the subagent shows these patterns across attempts, escalate:

| Pattern | Threshold | Action |
|---------|-----------|--------|
| No file changes | ≥3 attempts | Warn: "Stuck — no progress" |
| Very short iterations | ≥3 attempts (<30s) | Warn: "Subagent may be failing fast" |
| Same error repeated | ≥2 attempts | Warn: "Recurring error" |

When struggle is detected, inject context hint into the next attempt:
`"Hint: {struggle warning detail} — try a different approach."`

##### Promise Tag Convention

Every subagent dispatch prompt MUST include:
```
When the task is genuinely complete, output <promise>DONE</promise> on its own line.
Do NOT output this tag until the task is truly done.
```

The build verifier must scan output for `<promise>DONE</promise>` (or the task-specific promise tag) before accepting completion.

#### 2. Test

Write and run tests for the change:
- Unit tests for new functions/components
- Integration tests for cross-module changes
- Verify existing tests still pass

#### 3. Verify

Dispatch verifier gate:
- Type check: `tsc --noEmit`
- Lint: `bun run lint` or equivalent
- Test: `bun run test` or equivalent
- Build: `bun run build` or equivalent
- Capture actual output as evidence

#### 4. Review (Two-Stage)

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

#### 5. Commit

Conventional commit message format:
```
<type>(<scope>): <description>

- <detail>
```

Types: feat, fix, refactor, test, docs, chore, style

### Subagent Dispatch

#### Prompt Structure

Every subagent dispatch must include exactly these five fields:

| Field | Description |
|-------|-------------|
| Task description | Exact text from the plan |
| Relevant file paths | Paths to files the subagent needs (read-only access first) |
| Skill instructions | Which patterns, conventions, or skills to follow |
| Acceptance criteria | How to verify the task is done |
| Expected output format | What to return (diff, summary, status, concerns) |

#### Four Implementer Statuses

After each task dispatch, the implementer returns one of:

- **DONE** — task complete, proceed to Verify → Review
- **DONE_WITH_CONCERNS** — task complete but implementer flagged uncertainties. Surface concerns with evidence before continuing.
- **NEEDS_CONTEXT** — implementer couldn't proceed. Identify the exact missing context, provide it, re-dispatch.
- **BLOCKED** — external blocker. Create a new blocked plan iteration. Then stop.

#### Parallel Task Dispatch

When tasks are independent (no shared state, no ordering requirement), dispatch multiple implementers simultaneously:

1. **Scan plan for dependency graph**: read all tasks, identify dependencies
2. **Independent tasks** → dispatch in parallel (separate subagents, simultaneous)
3. **Dependent tasks** → order by dependency chain
4. **While waiting** for dependent results, prepare context (files, specs, acceptance criteria) for the next wave

#### When NOT to Parallelize

Do NOT parallelize when:

| Condition | Why |
|-----------|-----|
| Tasks share mutable state | Concurrent writes cause conflicts |
| One task produces artifacts another needs | Sequential by definition |
| First task informs second task's direction | Exploratory — second task depends on first task's findings |
| Combined context needed for coherence | Split context breaks consistency (e.g., cross-cutting refactors) |

When in doubt, run sequentially.

#### Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|--------------|---------|-----|
| Too broad scope | Single task covers too much | Split into smaller, focused tasks |
| No context provided | Subagent has no codebase reference | Always include file paths and relevant code |
| No constraints | Subagent doesn't know what NOT to do | State boundaries: "don't touch X", "stay in Y module" |
| Vague output | Subagent doesn't know what to return | Always specify expected output format in prompt |

#### Pipeline

- Fresh subagent per task (isolated context, no carryover state)
- Implementer → verifier → reviewer pipeline per task
- Pass: task description, relevant file paths, skill instructions, acceptance criteria

### Worktree Management

- Create worktree at start, track the path
- Clean up worktrees when done (after merge or discard)
- Never run git commands that affect other branches without explicit intent
- If a worktree already exists, reuse it rather than creating a new one

## Tool Requirements

- **bash**: Running git commands (worktree, commit), dependency installation, test/lint/build execution
- **read/write/edit**: File manipulation for implementation and documentation
- **grep**: Codebase search and pattern discovery
- **task**: Subagent dispatch with structured prompts
- **git** (via bash): Worktree management, branching, committing
- **bun** (via bash): Dependency installation, test runner, linter, bundler

## Output

Completed tasks verified through the gate pipeline, with:
- Tests passing
- Type checks passing
- Lint passing
- Build succeeding
- Spec compliance confirmed
- Code quality confirmed
- Conventional commits on an isolated feature branch

## Quality Criteria

- Every task passes verifier gate before review
- Stage 1 (Spec Compliance) must pass before Stage 2 (Code Quality)
- No Critical or Important issues remain after review
- Complete code with no placeholders
- All acceptance criteria met
- No scope drift from the approved plan

## When NOT to Use

- No approved implementation plan exists (use planner first)
- Tasks share mutable state that would cause concurrent write conflicts
- One task produces artifacts another depends on (sequential required)
- First task's findings inform the second task's direction (exploratory)
- Combined context is needed across tasks for coherence (e.g., cross-cutting refactors)

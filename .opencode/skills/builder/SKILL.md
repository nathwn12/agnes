---
id: builder
name: builder
description: 'A plan has been reviewed and approved by plan-reviewer, implementation is ready to start.'
phase: "BUILD"
use_when: "A plan has been reviewed and approved by plan-reviewer and needs in-progress implementation with isolated workspace execution."
version: 1.0
---

## Core Concept

Disciplined plan execution with isolated worktrees, per-task subagent dispatch, Build → Test → Verify → Review → Commit pipeline. Parallel dispatch where dependencies allow.

### Coding Priority Order

1. **Correctness** — Works for all inputs, edge cases
2. **Security** — No vulnerabilities, injection risks, data leaks
3. **Simplicity** — Simplest approach fully solving task
4. **Maintainability** — Understandable in 6 months
5. **Performance** — Optimize only when measured and necessary

## Precise Vocabulary

- **Worktree**: Isolated git working tree via `git worktree add`
- **Subagent dispatch**: Delegating task to separate agent with structured context
- **DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED**: Four implementer statuses
- **Stage 1 (Spec Compliance)**: Implementation matches plan/spec
- **Stage 2 (Code Quality)**: Tests, types, naming, patterns, security, performance
- **Conventional commit**: `<type>(<scope>): <description>`

### Executor Discipline

Builder delegates ALL bash to @executor. Never runs bash directly.

Delegated: test runs, builds, type checks, linters, formatters, static analysis, package install, dependency management — any command producing output.

@executor returns compact pass/fail with exact file:line for failures. Builder decides next action. Executor never suggests fixes.

## Context Requirements

- Reviewed and approved implementation plan must exist
- Plan tasks scoped to independent, dispatchable units
- Clean baseline with passing tests before changes
- Dependencies installed

## Workflow

### Workspace Isolation (Prerequisite)

#### Step 0: Detect Existing Isolation

Compare `git rev-parse --git-dir` vs `git rev-parse --git-common-dir`. If different (not submodule), in linked worktree — skip. Report path and branch.

#### Step 1: Create Isolated Workspace

##### 1a. Native Worktree Tools (preferred)
If platform provides isolation, use it and skip to Step 2.

##### 1b. Git Worktree Fallback
Directory priority: explicit preference > `.worktrees/` > `worktrees/` > `~/.config/superpowers/worktrees/` > `.worktrees/` at project root.

**Safety:** Verify directory git-ignored before creating. If not, add to `.gitignore` and commit.

Create: `git worktree add <path> -b <feature-branch>` then `cd <path>`.

**Windows:** Enable `core.longpaths true`. If fails, work in current directory.

#### Step 2: Project Setup & Baseline

Auto-detect project type. Verify clean baseline: tests pass before changes. If fail, report and ask whether to proceed.

#### Step 3: Clean Up (After Completion)

After merge/discard: `git worktree remove <path> && git branch -D <feature-branch>`.

### Execution Loop (per task in plan)

#### 1. Build (Ralph Loop)

Write code per spec. No placeholders. Ralph Loop:

```
For each task:
  1. maxRetries = 3, completionPromise = "DONE"
  2. For attempt = 1..maxRetries:
     a. Dispatch subagent with: task, acceptance criteria,
        "Output <promise>${completionPromise}</promise> when truly complete"
     b. Scan for <promise>TAG</promise>
     c. Found → Verify
     d. Not found, attempt < maxRetries → retry
     e. Track struggle
  3. MaxRetries exhausted → BLOCKED
```

| Status | Meaning | Action |
|--------|---------|--------|
| DONE | Task complete, promise detected | Verify → Review |
| DONE_WITH_CONCERNS | Promise detected, flagged uncertainties | Surface concerns with evidence |
| NEEDS_CONTEXT | Missing info | Fill gap, re-dispatch |
| BLOCKED | External blocker or max retries | New blocked plan iteration |

##### Struggle Detection

| Pattern | Threshold | Action |
|---------|-----------|--------|
| No file changes | ≥3 attempts | "Stuck — no progress" |
| Very short iterations | ≥3 (<30s) | "Subagent may be failing fast" |
| Same error repeated | ≥2 attempts | "Recurring error" |

Inject hint: `"Hint: {detail} — try different approach."`

##### Promise Tag

Every dispatch: `When complete, output <promise>DONE</promise> on its own line.`

#### 2. Test

- Unit tests for new functions/components
- Integration tests for cross-module changes
- Verify existing tests pass

#### 3. Verify

Dispatch verifier: `tsc --noEmit`, `bun run lint`, `bun run test`, `bun run build`. Capture actual output.

#### 4. Review (Two-Stage)

**Stage 1 — Spec Compliance:** matches plan/spec? All criteria met? No scope drift? Fail → fix → re-review before Stage 2.

**Stage 2 — Code Quality:** tests pass, types correct, naming consistent, patterns match, no security/performance regressions. Fix all Critical/Important.

#### 5. Commit

Conventional commit: `<type>(<scope>): <description>`. Types: feat, fix, refactor, test, docs, chore, style.

### Subagent Dispatch

#### Prompt Structure

Every dispatch: **task description** (from plan), **relevant file paths**, **skill instructions**, **acceptance criteria**, **expected output format**.

#### Parallel Task Dispatch

1. Scan plan for dependency graph
2. Independent tasks → parallel
3. Dependent tasks → ordered by chain
4. While waiting, prepare next-wave context

| Do NOT parallelize when | Why |
|------------------------|-----|
| Tasks share mutable state | Concurrent write conflicts |
| One produces artifacts another needs | Sequential by definition |
| First informs second's direction | Exploratory dependency |
| Combined context needed | Split breaks consistency |

When in doubt, sequential.

#### Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Too broad scope | Split into smaller tasks |
| No context provided | Include file paths and relevant code |
| No constraints | State boundaries: "don't touch X" |
| Vague output | Specify expected output format |

#### Pipeline

Fresh subagent per task. Implementer → verifier → reviewer. Pass: task, paths, instructions, criteria.

### Worktree Management

Create at start, track path. Clean up after merge/discard. Reuse existing. No git commands affecting other branches without intent.

## Tool Requirements

- **bash**: git, install, test/lint/build
- **read/write/edit**: File manipulation
- **grep**: Codebase search
- **task**: Subagent dispatch

## Output

Passing tests, type checks, lint, build. Spec compliance and code quality. Conventional commits on isolated branch.

## Quality Criteria

- Every task passes verifier before review
- Stage 1 passes before Stage 2
- No Critical/Important issues remain
- Complete code, no placeholders
- All acceptance criteria met, no scope drift

## When NOT to Use

- No approved plan (use planner first)
- Tasks share mutable state
- Sequential dependencies required
- Exploratory — findings inform next direction
- Cross-cutting refactors needing combined context

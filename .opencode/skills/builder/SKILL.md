---
id: builder
name: builder
description: 'A plan has been reviewed and approved by multi-reviewer, implementation is ready to start.'
phase: "BUILD"
use_when: "A plan has been reviewed and approved by multi-reviewer and needs in-progress implementation with isolated workspace execution."
version: 1.0
---

# builder

**Tradeoff:** Isolated parallelism catches cross-module conflicts early but costs worktree overhead and subagent dispatch latency.

## Core Concept

Disciplined plan execution: isolate → build (Ralph Loop) → test → verify → review → commit. Parallel dispatch where dependencies allow.

### Coding Priority Order

1. **Correctness** — works for all inputs including edge cases
2. **Security** — no injection risks, data leaks, or auth gaps
3. **Simplicity** — smallest solution that solves the task
4. **Maintainability** — another dev or AI understands this in 6 months
5. **Performance** — measure first, optimize second

## Precise Vocabulary

- **Worktree**: Isolated git working tree via `git worktree add`
- **Subagent dispatch**: Delegating task to separate agent with structured context
- **DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED**: Four implementer statuses
- **Stage 1 (Spec Compliance)**: Implementation matches plan/spec exactly
- **Stage 2 (Code Quality)**: Tests, types, naming, patterns, security, performance
- **Conventional commit**: `<type>(<scope>): <description>`

### Executor Discipline

Builder delegates ALL bash to @executor. Never runs bash directly. Commands: test runs, builds, type checks, linters, formatters, static analysis, package install, dependency management.

@executor returns compact pass/fail with exact `file:line` for failures. Builder reads, decides action. Executor never suggests fixes.

## Context Requirements

- Reviewed & approved plan exists
- Plan tasks scoped to independent dispatchable units
- Clean baseline with passing tests before changes
- Dependencies installed (`bun install` or equivalent)

## Workflow

### 1. Isolate

[Detect existing isolation] → verify: `git rev-parse --git-dir` ≠ `git rev-parse --git-common-dir` (or submodule via `--show-superproject-working-tree`)

[Create worktree] → verify: branch exists at worktree path, `git status` clean

Priority order: explicit preference > `.worktrees/` > `worktrees/` > `~/.config/superpowers/worktrees/` > `.worktrees/`

Safety: `git check-ignore -q .worktrees` before creating. Add to `.gitignore` if not ignored. Windows: `git config core.longpaths true`. If worktree fails, report error and work in current dir.

[Setup & baseline] → verify: `bun install` (or equiv), tests pass before changes

[Clean up after merge] → verify: `git worktree remove <path> && git branch -D <feature-branch>`

**Output:** Isolated workspace at `<path>` on branch `<name>` with passing baseline.

### 2. Build (Ralph Loop)

Per task in plan, iterative retry with promise-gated completion.

[Dispatch subagent] with: task description (exact from plan), relevant file paths (read-only first), skill instructions, acceptance criteria, expected output format. Include: `When complete, output <promise>DONE</promise> on its own line.`

[Scan output for `<promise>TAG</promise>`] → verify: tag present

[Retry if missing] max 3 attempts, same prompt

[Track struggle] → verify: noProgress (0 file changes ≥3), shortIterations (<30s ≥3), same error repeated (≥2). Inject `"Hint: {detail} — try different approach"` on retry.

[MaxRetries exhausted] → return BLOCKED, create new blocked plan iteration

| Status | Meaning | Action |
|--------|---------|--------|
| DONE | Promise detected | Proceed to Test |
| DONE_WITH_CONCERNS | Promise + flagged uncertainties | Surface evidence before proceeding |
| NEEDS_CONTEXT | Missing info | Fill gap, re-dispatch |
| BLOCKED | External blocker or max retries | New blocked plan iteration, stop |

**Output:** Implementation with DONE status, or BLOCKED iteration.

### 3. Test

[Unit tests] for new functions/components
[Integration tests] for cross-module changes
[Regression] existing tests still pass → verify: `bun run test` exits 0

**Output:** All tests passing.

### 4. Verify

Dispatch verifier gate → verify: `tsc --noEmit`, `bun run lint`, `bun run build` all pass. Capture actual output as evidence.

**Output:** Type checks, lint, build all clean.

### 5. Review (Two-Stage)

**Stage 1 — Spec Compliance** → verify: all acceptance criteria met, no scope drift, implementation matches plan. Fail → fix → re-review Stage 1 before Stage 2.

**Stage 2 — Code Quality** → verify: tests exist & pass, types correct, naming consistent, patterns match codebase, no security/performance regressions. Fix all Critical/Important issues.

**Output:** Approved review or fix list.

### 6. Commit

`git commit -m "<type>(<scope>): <description>"` with detail bullets. Types: feat, fix, refactor, test, docs, chore, style.

→ verify: commit exists on feature branch

**Output:** Conventional commit on feature branch.

### Subagent Dispatch

#### Prompt Structure

Every dispatch includes: **task description** (exact from plan), **relevant file paths** (read-only first), **skill instructions** (patterns/conventions), **acceptance criteria** (how to verify done), **expected output format** (diff, summary, status, concerns).

#### Parallel Task Dispatch

1. Scan plan for dependency graph
2. Independent tasks → parallel dispatch
3. Dependent tasks → order by dependency chain
4. Waiting for dependent results → prepare next-wave context

| Do NOT parallelize when | Why |
|-------------------------|-----|
| Tasks share mutable state | Concurrent write conflicts |
| One task produces artifacts another needs | Sequential by definition |
| First task informs second's direction | Exploratory dependency |
| Combined context needed for coherence | Split context breaks consistency |

When in doubt, run sequentially.

#### Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Too broad scope | Split into smaller focused tasks |
| No context provided | Always include file paths and relevant code |
| No constraints | State boundaries: "don't touch X", "stay in Y module" |
| Vague output | Always specify expected output format |

#### Pipeline

Fresh subagent per task. Implementer → verifier → reviewer per task. Pass: task description, file paths, skill instructions, acceptance criteria.

### Worktree Management

Create at start, track path. Clean up after merge/discard. Reuse existing worktrees. Never run git commands affecting other branches without explicit intent.

## Flow Diagram

```
[approved plan] → [isolate] → [build] ──→ [test] ──→ [verify] ──→ [review] ──→ [commit] → [feature branch]
                      ↑         ↑ retry x3 │                                      ↑ fail  │
                      └─────────┘           └──────────────────────────────────────┴────────┘
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| bash | Isolate, Test, Verify, Commit | git/dependency commands | worktree, test output, build artifact |
| read/write/edit | Build | spec context, plan tasks | modified source files |
| grep | Build, Review | search pattern | matching file:line refs |
| task | Build (dispatch) | task prompt + context files | subagent result with promise tag |

## Examples

| Scenario | Approach | Key Verify Check |
|----------|----------|------------------|
| New feature from plan | Isolate → Build → Test → Verify → Review → Commit | `bun run test && bun run build` passes |
| Bug fix | Build (regression test first) → Verify → Review | Bug gone, new test covers root cause |
| Refactor (no behavior change) | Build → Test → Verify → Review | Existing tests unchanged, all pass |
| Cross-module change | Build → Integration test → Verify → Review | Integration + unit tests pass |

## Output

Passing tests, type checks, lint, and build. Spec compliance and code quality confirmed. Commits on isolated feature branch.

## Quality Criteria

- → verify: Every task passes verifier gate before review
- → verify: Stage 1 (spec compliance) passes before Stage 2 (code quality)
- → verify: No Critical/Important issues remain
- → verify: Complete code, no placeholders
- → verify: All acceptance criteria met, no scope drift

## Protocol Shells

All build operations follow the protocol shell format:

/protocol {
  intent="Implement approved plan sub-task",
  input={ task="<plan-sub-task>", constraints="<scope>", files="<target-files>" },
  process=[ /decompose{breakdown}, /implement{changes}, /verify{output} ],
  output={ result="<implementation>", evidence="<test-output>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break plan sub-task into independent file-level changes |
| /verify | Check implementation matches spec before requesting review |
| /reflect | Self-critique draft before submitting for review |

## When NOT to Use

- No approved plan (use planner first)
- Tasks share mutable state (concurrent write conflicts)
- Sequential dependencies required
- Exploratory — findings inform next direction
- Cross-cutting refactors needing combined context

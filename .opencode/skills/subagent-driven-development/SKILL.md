---
name: subagent-driven-development
description: Execute implementation plans by dispatching one fresh subagent per task with two-stage review (spec compliance then code quality). Use for any multi-task plan.
---

# Subagent-Driven Development

Execute plan by dispatching one `general` subagent per task, with two-stage review after each: spec compliance review first, then code quality review.

Core principle: Fresh subagent per task + two-stage review = high quality, fast iteration.

## When to Use

- You have an implementation plan with 2+ independent tasks
- Tasks can be meaningfully reviewed individually
- You want quality gates without slowing down

## Process Flow

### 0. Setup
1. Read the plan file
2. Extract all tasks with full text and context — pre-load all task text upfront so subagents never need to read the plan file
3. Create a todo list from the tasks

### 1. Execute Tasks — One at a Time, with Review

For each task in order:

**Step A: Dispatch Implementer**

Use `agnes_delegate(agent, description, prompt, background=false)` with `agent='general'`.

Inject the implementer prompt template (`./implementer-prompt.md`), filling:
- `[TASK_FULL_TEXT]` — the complete task from the plan
- `[CONTEXT]` — where this fits, dependencies, architectural context

The implementer subagent:
1. Asks questions if anything is unclear — answer them
2. Implements exactly what the task specifies
3. Writes tests (following red-green-refactor)
4. Verifies implementation works
5. Self-reviews
6. Reports: DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT

**Step B: Spec Compliance Review**

If implementer reports DONE or DONE_WITH_CONCERNS, dispatch a spec reviewer subagent.

Use the spec reviewer prompt template (`./spec-reviewer-prompt.md`).

Reviewer reads the actual code (not the report) and verifies:
- All requirements implemented, nothing missing
- No extra features beyond spec
- No misunderstandings

If issues found: re-dispatch implementer to fix, then re-review.

**Step C: Code Quality Review**

After spec review passes ✅, dispatch a code quality reviewer.

Use the code quality reviewer prompt template (`./code-quality-reviewer-prompt.md`).

Reviewer checks: clean code, good tests, maintainable, follows patterns.

If issues found: re-dispatch implementer to fix, then re-review.

**Step D: Move On**

Mark task complete. Proceed to next task.

### 2. Final Verification

After all tasks complete:
1. Run full typecheck / lint / test suite
2. Present summary of what was built

## Prompt Templates

- `./implementer-prompt.md` — full template for implementation subagents
- `./spec-reviewer-prompt.md` — template for spec compliance review
- `./code-quality-reviewer-prompt.md` — template for code quality review

## Integration

Used after `writing-plans` creates an implementation plan.
Triggers `auto-verify` after all tasks complete.

## Key Rules

- Never dispatch multiple implementers in parallel (they touch same files)
- Never skip review stages
- Fix issues from reviews before marking task done
- Only stop for BLOCKED or genuine ambiguity — otherwise, continuous execution

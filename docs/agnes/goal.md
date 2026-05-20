# Goal

A goal is a completion condition that keeps AGNES focused across delegation waves. After every task, AGNES re-reads the goal and checks whether the condition is met. If not, it delegates the next wave. If yes, it reports done.

## When to set a goal

Any substantial work with a verifiable end state:

- Migrating a module until every call site compiles and tests pass
- Implementing a spec until all acceptance criteria hold
- Splitting a large file until each module is under a size budget
- Working a backlog until the queue is empty

## Write an effective condition

| Element | Why |
|---------|-----|
| **Measurable end state** | A test result, build exit code, file count, empty queue |
| **Stated check** | How AGNES proves it — "`bun run typecheck` exits 0", "`git status` is clean" |
| **Constraints** | What must not break along the way |

## Format

```
Goal: <sentence>

Check: <how to verify — command or observable state>

Constrained by: <what must not change, optional>

Done when: <condition satisfied or N turns elapsed>
```

## Evaluation

At the end of each delegation wave, AGNES:
1. Re-reads `docs/agnes/goal.md`
2. Checks if the condition is met (runs the command or inspects state)
3. If met → reports completion, clears the goal
4. If not → delegates the next wave toward the goal

## Examples

```
Goal: Auth module migrated to new API, all call sites updated
Check: npm run typecheck && npm t -- --testPathPattern=auth
Constrained by: no other module imports are changed
Done when: both commands exit 0
```

```
Goal: Queue of 12 issues in ready-for-agent is empty
Check: gh issue list --label ready-for-agent --json id | jq length
Done when: 0
```

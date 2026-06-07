---
name: writing-plans
description: Use when you have an approved design and need to create a detailed implementation plan with bite-sized tasks. Assume the implementer has zero context and questionable taste.
---

# Writing Plans

Write comprehensive implementation plans with bite-sized tasks. Assume the implementer knows nothing about the project and has questionable engineering judgment.

## Scope Check

If the design covers multiple independent subsystems, break into separate plans — one per subsystem.

## File Structure First

Before defining tasks, map out which files will be created or modified and what each one is responsible for:
- Each file should have one clear responsibility
- Files that change together should live together
- In existing codebases, follow established patterns
- Split files by responsibility, not by technical layer

## Bite-Sized Tasks

Each task (2-5 minutes max):
- "Write the failing test" — one step
- "Run it and watch it fail" — one step
- "Implement minimal code to pass" — one step
- "Run tests and confirm pass" — one step
- "Commit" — one step

## Plan Template

```
# [Feature Name] Implementation Plan

Goal: [One sentence]

Architecture: [2-3 sentences about approach]

Tech Stack: [Key technologies/libraries]

---

### Task N: [Component Name]

Files:
- Create: path/to/file
- Modify: path/to/file:123-145
- Test: path/to/test

- [ ] Step 1: [action]
  ```code or command```
- [ ] Step 2: [action]
  ...minimal, complete, no placeholders...
```

## Rules

- Every step has exact file paths
- Every step has complete code (no "similar to above")
- Every step has exact commands with expected output
- DRY, YAGNI, TDD, frequent commits
- No placeholders: no "TBD", "TODO", "implement later", "add error handling" without showing how
- No references to types/functions not defined in any task

## Self-Review

After writing, check:
1. Does every design requirement map to at least one task?
2. Any placeholders? Fix them.
3. Are types/signatures consistent across tasks?
4. Can an implementer follow this without asking questions?

## Handoff

After saving the plan, use `subagent-driven-development` skill to execute it.

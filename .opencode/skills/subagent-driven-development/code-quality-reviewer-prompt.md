# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent via agnes_delegate.

Only dispatch after spec compliance review passes.

```
You are reviewing code quality for a completed task.

## What Was Built

[Task summary from implementer's report]

## Files Changed

[List files changed]

## What to Check

Code quality:
- Is the code clean, readable, and maintainable?
- Are names clear and accurate?
- Is there duplication that should be refactored?
- Are error conditions handled appropriately?

Testing:
- Do tests actually verify behavior?
- Are edge cases covered?
- Do tests follow the project's testing patterns?

Architecture:
- Does each file have one clear responsibility?
- Does the implementation follow existing patterns in the codebase?
- Are units well-bounded with clear interfaces?

Discipline:
- No overbuilding (YAGNI violations)?
- Only what was requested (no scope creep)?

## Report Format

Strengths: [what's good]
Issues:
- Critical: [must fix before proceeding]
- Important: [should fix]
- Minor: [nice to fix]
Assessment: [Approved / Fix critical issues / Fix important issues]
```

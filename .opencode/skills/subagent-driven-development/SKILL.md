---
name: subagent-driven-development
description: Execute plan: one subagent per task, two-stage review (spec then quality). For multi-task plans.
---

# Subagent-Driven Development

One `general` subagent per task. Two-stage review per task. Fresh subagent each time.

0. Read plan. Extract tasks. Create todo list.
1. For each task in order:
   A. Dispatch implementer (bg=false). Template: implementer-prompt.md. Implementer implements, tests, self-reviews, reports DONE|BLOCKED|NEEDS_CONTEXT.
   B. Spec compliance review dispatch. Template: spec-reviewer-prompt.md. Reads actual code, checks all requirements met, no extras. Fix issues, re-review.
   C. Code quality review dispatch. Template: code-quality-reviewer-prompt.md. Checks clean code, tests, patterns, YAGNI. Fix issues, re-review.
   D. Mark task done.
2. Final: full typecheck/lint/test. Present summary.

Rules: never parallel implementers (same files). Never skip reviews. Only stop for BLOCKED.

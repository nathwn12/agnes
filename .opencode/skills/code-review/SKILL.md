---
name: code-review
description: Review code for quality, correctness, and spec compliance. One-pass review by subagent.
---

# Code Review

## When to Use
After implementation tasks, before final verification, or when explicitly requested.

## Process

### 1. Dispatch Reviewer Subagent
Create a focused review prompt with:
- Files changed (exact paths)
- What the task was supposed to do
- Any specific concerns

### 2. Review Categories
Reviewer classifies issues:
- **Critical**: Bug, security hole, data loss risk — must fix before proceeding
- **Important**: Maintainability, performance, incorrect but non-breaking — should fix
- **Minor**: Style, naming, comments — nice to fix

### 3. Review Notes
No re-review loop by default. Fix issues, run verification, move on.
If 3+ Critical issues found: consider a second review pass.

## Integration
In question-gate mode: present review summary + ask if user wants changes.
In YOLO mode: auto-fix Critical and Important issues, log Minor.

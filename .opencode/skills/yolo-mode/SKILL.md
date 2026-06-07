---
name: yolo-mode
description: Execute autonomously with maximum parallelization and no questions. Only stop for data loss or irreversible damage.
---

# YOLO Mode

## When to Use
Triggered by: `--yolo`, `--auto`, `yolo mode`, `/yolo`, `/auto`.

## Process

### 1. Maximum Parallelization
- Decompose to finest granularity (individual functions if practical)
- Dispatch 3+ subagents simultaneously
- Use background=true for all independent work
- Chain sequential dependencies without pausing
- Cap at 10 concurrent subagents

### 2. Skip All Gates
- No option presentation
- No waiting for approval
- Make the best architectural decision autonomously
- Document decisions in code/commit messages

### 3. Safety Protocol
ONLY interrupt for:

DATA LOSS:
- Deleting files or directories (write, edit, rm)
- Destructive git operations (reset --hard, branch -D, clean -fd, push --force)
- Overwriting files without backup

IRREVERSIBLE CHANGES:
- Database schema migrations
- API breaking changes to published interfaces
- Package.json dependency version bumps
- Renaming public symbols (classes, functions, exports)

SECURITY BREACHES:
- Committing secrets, tokens, or passwords
- Opening network ports without justification
- Adding dependencies with known vulnerabilities
- Modifying authentication or authorization logic

Format:
```
⚠️ SAFETY: About to [action]. This [consequence]. Proceed? (y/n)
```

If user confirms → continue. No further gates on same category.
Everything else → decide and execute.

### 4. Auto-Verify
After completion, run typecheck/lint/test. On failure, auto-diagnose and fix. Only interrupt if 3+ fix attempts fail.

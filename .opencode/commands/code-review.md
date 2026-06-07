---
description: Review code for quality, security, maintainability
subtask: true
---

# Code Review: $ARGUMENTS

1. `git diff --name-only HEAD` → changed files
2. Check each for: security (CRITICAL), quality (HIGH), best practices (MED), style (LOW)

Report: `**[SEV]** file:line — Issue → Fix`

Block on CRITICAL/HIGH. Recommend MED. Optional LOW.

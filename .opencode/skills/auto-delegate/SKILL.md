---
name: auto-delegate
description: Auto-decompose work by file boundary and dispatch parallel subagents. Use for any multi-file task.
---

# Auto-Delegation

When: task touching 2+ files or multi-area research.

1. Enumerate files. Assign each to exactly ONE subagent. For >300 line files, split by function.
2. Independent files → parallel (bg=true, max 10). Dependent files → sequential (blocking). Each subagent gets exact path + what to do + collision guard.
3. Poll with `agnes_get_result`. Check for ERROR → re-delegate. Verify no file overlaps. Merge non-overlapping changes.
4. 3+ errors same file → stop, escalate.

---
name: auto-delegate
description: Automatically decompose work by file boundary and dispatch parallel subagents. Use for any multi-file task.
---

# Auto-Delegation

## When to Use
Any task touching 2+ files, or any task involving research across multiple areas.

## Process

### 1. Decompose
- Split by file boundary: one subagent per file
- For large files (>300 lines), split by function/class boundary
- For exploration, split by top-level directory
- Identify dependencies (file A must be done before file B)

### 2. Dispatch
- Independent files → parallel dispatch (background=true, 3 at a time)
- Max 10 concurrent subagents at once (system ceiling — never exceed)
- Dependent files → sequential chain (blocking)
- Each subagent gets: exact file path, what to do, existing patterns to follow
- Include conflict guard in each prompt: "Only modify files assigned to you. If another agent touched this file, read both outputs and merge."

### 3. Collect
- Use `agnes_get_result` to poll parallel tasks (poll every few turns, don't busy-wait)
- Detect conflicts: check if two subagents modified the same file path or same function name
- CONFLICT RESOLUTION: if two subagents modified overlapping code, read both outputs side by side, identify the overlap, and either merge manually or re-delegate with combined context and explicit merge instructions
- Merge non-overlapping changes automatically

### 4. Error Recovery
- Subagent returns ERROR → read the error, diagnose, re-delegate with corrected context
- Subagent returns PENDING for too long → consider re-dispatched with smaller scope
- Conflict → present options (question-gate) or auto-merge (YOLO)
- 3+ errors on same file → stop and escalate to user or broader architecture review

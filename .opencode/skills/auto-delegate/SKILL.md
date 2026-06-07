---
name: auto-delegate
description: Automatically decompose work by file boundary and dispatch parallel subagents. Use for any multi-file task.
---

# Auto-Delegation

## When to Use
Any task touching 2+ files, or any task involving research across multiple areas.

## Process

### 1. Enumerate and Assign
- List every file that needs to change
- Assign each file to exactly ONE subagent — no two agents may touch the same file
- Build an assignment table like:
  ```
  File A → Subagent 1
  File B → Subagent 2
  File C → Subagent 3
  ```
- For large files (>300 lines), split by function/class boundary (distinct sub-sections to different agents)
- For exploration, split by top-level directory
- Identify dependencies (file A must be done before file B)

### 2. Dispatch
- Independent files → parallel dispatch (background=true, up to 10 at a time)
- Max 10 concurrent subagents at once (system ceiling — never exceed) — always dispatch them ALL simultaneously, never serialize
- Dependent files → sequential chain (blocking)
- Each subagent gets: exact file path, what to do, existing patterns to follow
- Include collision guard in EVERY prompt: "You are ONLY authorized to modify: [assigned files]. Do NOT touch any other files. If another subagent's output affects your work, describe the conflict — do not overwrite."

### 3. Collect
- Use `agnes_get_result` to poll parallel tasks (poll every few turns, don't busy-wait)
- Check each returned result for ERROR — diagnose and re-delegate with corrected context
- Verify: did any subagent touch a file outside their assignment? If so, revert that file and re-delegate.
- CONFLICT RESOLUTION: if two subagents modified overlapping code (should not happen with pre-assignment but guard), read both outputs side by side, identify the overlap, and either merge manually or re-delegate with combined context and explicit merge instructions
- Merge non-overlapping changes automatically

### 4. Error Recovery
- Subagent returns ERROR → read the error, diagnose, re-delegate with corrected context
- Subagent returns PENDING for too long → consider re-dispatched with smaller scope
- 3+ errors on same file → stop and escalate to user or broader architecture review

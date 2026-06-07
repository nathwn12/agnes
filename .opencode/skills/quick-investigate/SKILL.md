---
name: quick-investigate
description: Find root cause before fixing. Use for any bug, unexpected behavior, or test failure.
---

# Quick Investigate

## When to Use
Any bug, test failure, crash, or unexpected behavior.

## Process

### 1. Root Cause (MANDATORY)
Before any fix:
- Read the error output fully
- Reproduce if possible
- Check recent changes (git diff)
- Trace back: what input → what code path → what failure?
- If multi-component: add diagnostic logging at boundaries

### 2. One Hypothesis at a Time
- Form a single hypothesis
- Test it minimally
- Verify before forming next hypothesis
- If you don't know: say "I don't know yet" and investigate more

### 3. Fix + Verify
- Apply the fix
- Run verification (auto-verify)
- Confirm root cause is resolved (not just symptoms)

### 4. Three Strikes Rule
If 3+ fix attempts failed:
- STOP fixing
- In question-gate: report and ask for guidance
- In YOLO: escalate to broader context (check architecture, not just the bug)

## Integration
Parallel investigation: for independent failures, dispatch one subagent per failure domain.

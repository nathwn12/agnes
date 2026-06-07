---
name: auto-verify
description: Run verification (typecheck/lint/test) before claiming completion. Read the output before reporting.
---

# Auto-Verify

## When to Use
After any implementation task, before claiming "done".

## Process

### 1. Run Checks
Based on project profile detected by AGNES:
- TypeScript/JS: run `tsc --noEmit` or `bun run typecheck`
- Lint: `bun run lint` or equivalent
- Test: `bun test` or equivalent
- Build: `bun run build` if applicable

### 2. Read Output
- Read the full output (not just exit code)
- Look for errors, warnings, new failures
- Count failures: is this better or worse than before?

### 3. On Success
Report with evidence:
```
✅ Passed: typecheck (0 errors), lint (0 warnings), test (42 passed)
```

### 4. On Failure
- Question-gate mode: present failure + options (fix now / investigate / skip)
- YOLO mode: auto-diagnose, fix, re-verify. Interrupt only after 3 attempts.

## Integration
Called automatically by SOUL.md's "verify before claiming done" rule.

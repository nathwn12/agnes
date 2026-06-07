---
name: auto-verify
description: Run typecheck/lint/test before claiming completion. Read output first.
---

# Auto-Verify

After any implementation, before claiming done:

1. Run: `tsc --noEmit` / `npm run lint` / `npm test` / `npm run build`
2. Read full output. Count failures.
3. Success: report with evidence (✅ typecheck 0 errors, lint 0 warnings, test 42 pass).
4. Failure: gate mode → present options; YOLO → auto-diagnose, fix, re-verify (max 3 attempts).

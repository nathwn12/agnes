---
name: verifier
id: verifier
phase: VERIFY
description: 'After any code change before claiming any task is complete, before shipper starts.'
---
## RULES
- NO COMPLETION WITHOUT FRESH VERIFICATION EVIDENCE. Previous runs don't count
- Run gates in order. Stop on first failure
- Type Check: `tsc --noEmit`. Zero errors. Capture full output
- Lint: project linter. Zero errors. Capture warnings separately
- Test: project test runner. Capture suites/tests passed/failed
- Build: production compilation. Verify output exists with expected size
- AGNES Message Scan: search for `<!-- <agnes:message>{...}</agnes:message> -->`. Must be schema agnes/message-v1 with status DONE. Raw JSON/fenced/promise tags do NOT satisfy
- Contract/DoD: each assertion evidence-backed. Failed/pending blocks gate
- Rationalization Guard: "should work", "it passed yesterday", "just this once" — all rejected. Run NOW
- Delegates ALL bash to @general. Never runs bash directly

## FLOW
Type Check → Lint → Test → Build → AGNES Message Scan → Contract/DoD → Evidence Capture

## TRIGGERS
- After any code change 
- Before claiming any task is complete, before shipper starts
- DoD contract with evidence-backed assertions

## NEXT
- reviewer — review verification results
- shipper — after all gates pass


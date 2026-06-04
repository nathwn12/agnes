---
name: grill-me
id: grill-me
phase: DEBUG
description: 'debugger has narrowed but not resolved, complex multi-file bugs with no clear hypothesis, recurring issues that were "fixed" before.'
---
## RULES
- 6-phase discipline. Full control, relentless, methodical
- 3-fail rule: 3 wrong hypotheses → architecture wrong. Recommend redesign
- Backward tracing: start at symptom, trace data backward through each layer
- One variable at a time instrumentation
- Regression test: <100ms, fails before fix, passes after
- All findings saved to `.agnes/learnings/`
- Non-deterministic: ≥60% repro target. Loop, parallelize, stress, delay
- Performance: measure first, fix second. Baseline before bisect

## FLOW
1. Build feedback loop — fast deterministic pass/fail in 1 command
2. Reproduce — confirm right bug, run ≥3x verify reproducibility
3. Hypothesise — 3-5 ranked falsifiable. Each: cause, prediction, exact test command
4. Instrument — tagged `[DEBUG-XXXX]`, one hypothesis at a time
5. Fix + regression test — failing test first, apply fix, verify pass, re-run repro
6. Cleanup — grep `[DEBUG-*]`, remove all. Confirm bug gone. Document root cause

## TRIGGERS
- debugger narrowed but not resolved
- Complex multi-file bugs, no clear hypothesis
- Recurring issues that were "fixed" before

## NEXT
- verifier: verify fix passes quality gates
- architect: if architecture change needed

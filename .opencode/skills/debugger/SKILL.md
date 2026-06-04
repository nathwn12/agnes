---
name: debugger
id: debugger
phase: DEBUG
description: 'User says "this is broken", error reports without clear root cause, performance regressions needing investigation.'
---
## RULES
- No fixes without root cause investigation first
- Build fast deterministic pass/fail feedback loop first — disproportionate effort here
- Loop strategies (try in order): failing test at seam, curl against dev server, CLI with fixture input + diff, headless browser, replay trace, throwaway harness, fuzz loop, bisection harness
- Non-deterministic: higher repro rate, not clean. Loop 100x, parallelize, stress
- Cannot build loop? List attempts. Ask user for env/artifact/permission
- 3-5 ranked falsifiable hypotheses before testing any. Each: "If X, then changing Y makes bug disappear"
- Tag debug logs with `[DEBUG-XXXX]`. Cleanup = single grep
- Root cause: trace backward through call chain. Fix at source
- 3 rounds unclear + <3 fixes attempted → back to Phase 2. ≥3 → handoff to grill-me
- Write regression test before fix. Defense-in-depth at every data layer

## FLOW
1. Build feedback loop: fast deterministic pass/fail signal
2. Reproduce: run loop, confirm failure, reproducibility rate, exact symptom
3. Explore: code, git log -20, error logs, stack traces, known issues, deps
4. Hypothesise: 3-5 ranked falsifiable hypotheses. Show user
5. Instrument: targeted logging one variable at a time. Tag all
6. Narrow: share findings, repeat until root cause found
7. Fix + regression test: failing test → fix → pass → re-run loop → full suite. Add defense
8. Document: root cause (1 sentence), repro, fix, defense. Clean [DEBUG-*]

## TRIGGERS
- "This is broken", error reports without clear root cause
- Performance regressions needing investigation

## NEXT
- verifier: verify fix passes quality gates
- architect: if fix involves architectural change
- grill-me: after 3+ narrowing rounds without resolution

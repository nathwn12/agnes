---
id: debugger
name: debugger
description: 'User says "this is broken, help me figure out why", error reports without clear root cause, performance regressions needing investigation.'
phase: "DEBUG"
use_when: "User says \"this is broken, help me figure out why\", error reports without clear root cause, performance regressions needing investigation."
version: 1.1
---

## Use When

User says "this is broken", error reports without root cause, performance regressions.

## Core Concept

**The Iron Law:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST. Symptom fixes fail. Random fixes waste time, create bugs.

7-step loop: Reproduce → Explore → Hypothesise → Ask → Instrument → Narrow → Document. User is partner at every decision point.

## Precise Vocabulary

- **Hypothesis**: Falsifiable, specific, ranked statement about root cause. Names module, defines how to disprove.
- **Instrumentation**: Targeted logging/assertions with tagged markers (`[DEBUG-a4f2]`) for cleanup.
- **Narrowing**: Sequential elimination of hypotheses, one variable at a time.
- **Reproduction**: Confirming bug with exact steps, input, environment, expected vs actual.
- **Root Cause**: Minimal underlying fault — one sentence. Fix at source.
- **Falsifiable**: Provable wrong by specific experiment. No prediction = vibe.
- **Feedback Loop**: Fast, deterministic, agent-runnable pass/fail signal. Most important tool.
- **Defense-in-Depth**: Validation at every layer data passes through.
- **Bisection**: Halving search space (commits, input, timing).

## Context Requirements

- Source code access
- Git history (`git log --oneline -20`)
- Error logs, stack traces, console output
- Ability to run code and add instrumentation
- User availability (one question at a time)

## Workflow

### Phase 0: Build a Feedback Loop (Critical)

Before any hypothesis or fix, build fast, deterministic, agent-runnable pass/fail signal. Spend disproportionate effort here.

Ways to construct (try in order):
1. **Failing test** at seam reaching bug
2. **Curl / HTTP script** against dev server
3. **CLI invocation** with fixture input, diff stdout vs snapshot
4. **Headless browser** (Playwright)
5. **Replay captured trace** through isolated code path
6. **Throwaway harness** — minimal subset exercising bug path
7. **Property / fuzz loop** — 1000 random inputs
8. **Bisection harness** for `git bisect run`
9. **Differential loop** — same input, old vs new, diff outputs

**Iterate on loop.** Faster? Sharper signal? More deterministic? 30s flaky loop barely helps. 2s deterministic loop is superpower.

**Non-deterministic bugs:** Higher reproduction rate, not clean repro. Loop 100x, parallelise, stress, inject sleeps. 50% flake debuggable; 1% is not.

**Cannot build a loop?** Say so. List attempts. Ask user for: environment access, captured artifact (HAR, log dump, core dump), or permission for production instrumentation.

### Phase 1: Reproduce

Run loop. Confirm:
- [ ] Produces user's failure mode
- [ ] Reproducible (or high enough rate)
- [ ] Exact symptom captured

### Phase 2: Explore

Check code, recent changes, logs:
- `git log --oneline -20`
- Read relevant source
- Error logs, stack traces
- Known issues or dependency changes
- For multi-component systems: diagnostic instrumentation at each component boundary before proposing fixes. Log enters/exits. Verify environment/config propagation.

**Root cause tracing:** Trace backward through call chain. Ask: What code directly causes this? What called that? What value? Where from? Fix at source. If can't trace, add stack trace instrumentation.

### Phase 3: Hypothesise

**3-5 ranked hypotheses before testing any.** Single hypothesis anchors on first plausible idea. Each must be falsifiable.

Format: "If <X> is cause, then <changing Y> will make bug disappear."

Each must be:
- Specific — "X module" not "somewhere"
- Falsifiable — "changing Y will make bug disappear"
- Ranked — by likelihood

Show ranked list to user before testing.

### Phase 4: Ask User

Present hypotheses. One question at a time. Let them guide.

### Phase 5: Instrument

Targeted logging/assertions, one variable at a time. Each probe maps to specific prediction.

Preference:
1. **Debugger / REPL** — one breakpoint beats ten logs
2. **Targeted logs** at boundaries distinguishing hypotheses
3. Never "log everything and grep"

**Tag every debug log** with `[DEBUG-a4f2]`. Cleanup = single grep.

**Performance regressions:** Baseline measurement first, then bisect. Measure then fix.

### Phase 6: Narrow

Share findings, ask next question, repeat until root cause found. Verify after each instrumentation.

3 rounds and still unclear? STOP. Count fixes attempted. < 3 → return to Phase 2. ≥ 3 → handoff to grill-me.

### Phase 7: Fix + Regression Test

Write regression test **before fix** — if correct seam exists.

If correct seam exists:
1. Turn minimised repro into failing test
2. Watch it fail
3. Apply fix (ONE change, no bundled refactoring)
4. Watch it pass
5. Re-run Phase 0 feedback loop
6. Run full test suite

No correct seam? Note it, flag for architecture improvement.

**Defense-in-depth:** Add validation at every data layer: entry point, business logic, environment guards, debug instrumentation. Make bug structurally impossible.

### Phase 8: Document

```markdown
## Bug: [Title]

### Root Cause
[One sentence]

### Reproduction
1. Step 1
2. Step 2

### Fix
[Description or commit ref]

### Defense Added
[Validation layers preventing recurrence]
```

If fix involves architectural change, hand off to architect.

## Tool Requirements

- **git**: Check commits, bisect
- **logging**: Tagged instrumentation
- **explorer**: Understand affected code
- **hypothesis-testing**: Ranked falsifiable hypotheses
- **feedback-loop**: Fast deterministic pass/fail
- **grill-me**: Handoff when 3+ narrowing rounds fail

## Output

Bug report: root cause (one sentence), reproduction, fix reference, defense summary. Clean all `[DEBUG-...]` markers.

## Quality Criteria

- Feedback loop built before hypotheses or fixes
- One question at a time
- Each hypothesis specific, falsifiable, ranked
- Debug logs tagged with unique markers
- User consulted at every decision point
- Findings shared immediately after instrumentation
- Regression test before fix (when seam exists)
- Defense-in-depth after fix
- All instrumentation removed

## When NOT to Use

- No reproduction steps available
- Third-party dependency without workaround — report upstream
- After 3 narrowing rounds without root cause → handoff to grill-me
- User asking for architectural improvement, not bug diagnosis

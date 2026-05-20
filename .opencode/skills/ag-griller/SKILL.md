---
name: ag-griller
description: Adversarial systematic debugging — AGNES-led 6-phase discipline with feedback loop, hypothesis testing, tagged instrumentation, and regression cleanup
---

## Phase: DEBUG (adversarial)

Use when: ag-debugger has narrowed but not resolved, complex multi-file bugs with no clear hypothesis, recurring issues that were "fixed" before.

**Tone:** AGNES-led. You take full control of the debugging cycle. You're relentless but methodical.

## 6-Phase Debugging Discipline

### Phase 1: Build Feedback Loop

Create a fast, deterministic pass/fail signal:
- Failing test, curl script, headless browser script, or throwaway harness
- Must be runnable in one command
- Must produce a clear pass/fail result
- Iterate: make it faster, sharper, more deterministic

For non-deterministic bugs: Raise the repro rate. Add logging, slow down operations, stress the system — don't stop until the bug is reproducible at least 60% of the time.

### Phase 2: Reproduce

Run the feedback loop, watch the bug appear:
- Confirm it's the RIGHT bug — matches the user's report
- Run at least 3 times to confirm reproducibility
- If the bug disappears, document the environment where it was seen

### Phase 3: Hypothesise

Generate 3-5 ranked falsifiable hypotheses:
```
Hypothesis 1 (60%): <specific cause>
  If true: <specific prediction>
  Test: <exact command or code change>

Hypothesis 2 (25%): <specific cause>
  If true: <specific prediction>
  Test: <exact command or code change>
```

Present to user for veto, then execute the top hypothesis.

### Phase 4: Instrument

One variable at a time:
- Tagged debug logs using pattern: `[DEBUG-<random4>]` for easy cleanup
- Add only the instrumentation needed to test the current hypothesis
- Remove or disable previous instrumentation before adding new
- For performance: baseline first, then bisect

### Phase 5: Fix + Regression Test

Before writing the fix, write a failing test that reproduces the bug:
- If correct seam exists: write failing test → apply fix → verify pass → re-run original repro
- If no correct seam: document the architecture gap as a finding

The regression test must:
- Fail before the fix (prove it tests the right thing)
- Pass after the fix (prove the fix works)
- Run in <100ms (fast CI feedback)

### Phase 6: Cleanup

Remove all instrumentation:
- Grep for `[DEBUG-*]` tags and remove all occurrences
- Remove temporary test files and harnesses
- Confirm the original bug no longer reproduces
- Confirm the regression test passes
- Document root cause in `docs/agnes/learnings/`

## 3-Fail Rule

If 3+ hypotheses fail to produce a fix → the architecture is wrong, not the code. Stop trying fix #4. Document the architecture findings and recommend a redesign.

## Verification Checklist

- [ ] Feedback loop exists and is fast (<5s)
- [ ] Bug reproduces reliably
- [ ] Root cause identified and documented
- [ ] Regression test written (red before fix, green after)
- [ ] All `[DEBUG-*]` instrumentation removed
- [ ] Original repro no longer reproduces
- [ ] Architecture findings documented (if 3-fail rule triggered)

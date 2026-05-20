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

**10 feedback loop strategies (ranked by preference):**

1. **Failing test** — Fastest, most reliable. Write a test that asserts the expected behavior. Red before fix, green after.
2. **curl / HTTP request** — For API and web bugs. Hit the endpoint directly with known payload, assert response.
3. **CLI invocation with known input** — For CLI tools. Run with predetermined args, assert stdout/stderr/exit code.
4. **Headless browser script** — For UI bugs. Script navigation, interaction, and screenshot/assertion checks.
5. **Replay trace** — Record a real session and replay it deterministically. Captures timing and state.
6. **Throwaway harness** — Minimal script (5-20 lines) that exercises only the buggy code path. No test framework needed.
7. **Fuzz** — Random inputs, look for crashes or assertion failures. Good for edge-case discovery.
8. **Bisection** — Binary search through commits to find where the bug was introduced. `git bisect`.
9. **Differential loop** — Run working variant and broken variant side by side, diff the output/behavior.
10. **HITL bash script** — Human-in-the-loop. Last resort when fully automated reproduction is impossible (see pattern below).

**HITL (Human-In-The-Loop) bash script pattern:**

When fully automated reproduction is impossible, create a script that guides the human through the repro steps and captures structured output:

```
# scripts/hitl-<bug>.sh
step() { echo "=== STEP: $* ===" >&2; }
capture() { echo "$1=$2" >> /tmp/hitl-output.txt; }

step "Open the app and navigate to settings"
read -p "What do you see? " result
capture "SETTINGS_PAGE" "$result"

step "Click the 'Save' button"
read -p "Does it show an error? (y/n): " result
capture "SAVE_ERROR" "$result"

echo "=== HITL complete ==="
cat /tmp/hitl-output.txt
```

Use `step()` to describe what the human should do, `capture()` to record structured responses. Outputs `KEY=VALUE` for agent parsing.

**Non-deterministic bug techniques:**

Goal is NOT a clean repro (may be impossible) but HIGHER repro rate:
- Loop the repro 100x and measure frequency
- Parallelize to increase contention
- Add stress (memory pressure, CPU load, network latency)
- Inject sleeps/delays at suspected race points
- 50% flake = debuggable; 1% flake = not (move on)
- Add logging, slow down operations, stress the system — don't stop until the bug is reproducible at least 60% of the time

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

After 3 hypotheses are proven wrong:
- Stop. The architecture is wrong, not the code.
- Do NOT attempt a 4th fix.
- Document what was tried and why each failed
- Recommend a redesign or deeper investigation
- Save to `docs/agnes/learnings/` as an architectural learning

## Rationalization Table

| Excuse | Counter |
|--------|---------|
| "It should work" | Run it. Now. |
| "It passed yesterday" | Yesterday's weather. Run it now. |
| "Works on my machine" | Not a claim, find the environment diff |
| "I'll check later" | No. Check now or document as assumption |
| "The test must be wrong" | Prove it. Show why the test is wrong. |
| "This is a simple fix" | Famous last words. Debug first. |
| "I don't need to reproduce it" | You ALWAYS need to reproduce it. |

## Backward Tracing Pattern

- Start at the symptom (error message, crash, wrong output)
- Trace data flow BACKWARD through each layer boundary
- At each boundary, add diagnostic instrumentation
- Ask: "What input to THIS layer would produce this output?"
- Repeat until reaching the root cause layer

## Performance Regression Specific

- Measure FIRST, fix second. Never optimize without baseline.
- Use profiling tools before guessing bottlenecks.
- Compare before/after with statistical significance.
- One change at a time between measurements.

## Verification Checklist

- [ ] Feedback loop exists and is fast (<5s)
- [ ] Bug reproduces reliably
- [ ] Root cause identified and documented
- [ ] Regression test written (red before fix, green after)
- [ ] All `[DEBUG-*]` instrumentation removed
- [ ] Original repro no longer reproduces
- [ ] Architecture findings documented (if 3-fail rule triggered)

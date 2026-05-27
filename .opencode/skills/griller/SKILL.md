---
id: griller
name: griller
description: 'debugger has narrowed but not resolved, complex multi-file bugs with no clear hypothesis, recurring issues that were "fixed" before.'
phase: "DEBUG"
use_when: "debugger has narrowed but not resolved, complex multi-file bugs with no clear hypothesis, recurring issues that were \"fixed\" before."
version: 1.0
---

## Use When

debugger has narrowed but not resolved, complex multi-file bugs with no clear hypothesis, recurring issues that were "fixed" before.

## Core Concept

**Tone:** AGNES-led. You take full control of the debugging cycle. You're relentless but methodical.

Debugging is an adversarial process. The griller owns the full cycle — building a fast feedback loop, generating ranked falsifiable hypotheses, instrumenting precisely one variable at a time, then fixing with a regression test that proves the root cause. The 6-phase discipline is the backbone. The 3-fail rule is the safety valve: if three hypotheses are wrong, the architecture is wrong, not the code.

**Backward Tracing Pattern:**

- Start at the symptom (error message, crash, wrong output)
- Trace data flow BACKWARD through each layer boundary
- At each boundary, add diagnostic instrumentation
- Ask: "What input to THIS layer would produce this output?"
- Repeat until reaching the root cause layer

## Precise Vocabulary

- **Feedback loop:** A fast, deterministic pass/fail signal that reproduces the bug in one command and produces a clear pass/fail result
- **HITL (Human-In-The-Loop):** A bash script pattern that guides a human through manual repro steps and captures structured KEY=VALUE output for agent parsing, used when full automation is impossible
- **Falsifiable hypothesis:** A ranked prediction of root cause with a specific "if true, then X" consequence and an exact test to prove or disprove it
- **Instrumentation:** Tagged debug logs using the pattern `[DEBUG-<random4>]` for easy identification and cleanup during the cleanup phase
- **Regression test:** A test that fails before the fix (proves it tests the right thing), passes after the fix (proves the fix works), and runs in <100ms
- **3-Fail Rule:** After three proven-wrong hypotheses, stop — the architecture is wrong, not the code — document and recommend redesign
- **Seam:** An architecture boundary where a test can meaningfully isolate a layer; the presence or absence of correct seams determines whether a regression test can be written
- **Non-deterministic bug:** A bug that doesn't reproduce reliably; the goal shifts from clean repro to achieving >60% repro rate through looping, parallelization, stress, or delay injection

## Context Requirements

- A bug report or symptom description (error message, crash, wrong output, performance regression)
- debugger has been applied and has narrowed the scope but not resolved the root cause
- Access to the codebase, test infrastructure, and reproduction environment
- For HITL scenarios: a collaborating human who can follow scripted interaction steps

## Workflow

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
- Document root cause in `.agnes/learnings/`

### 3-Fail Rule

After 3 hypotheses are proven wrong:
- Stop. The architecture is wrong, not the code.
- Do NOT attempt a 4th fix.
- Document what was tried and why each failed
- Recommend a redesign or deeper investigation
- Save to `.agnes/learnings/` as an architectural learning

### Performance Regression Specific

- Measure FIRST, fix second. Never optimize without baseline.
- Use profiling tools before guessing bottlenecks.
- Compare before/after with statistical significance.
- One change at a time between measurements.

## Tool Requirements

- **bash** — Running feedback loops, scripts, git bisect, CLI commands, test runners
- **read** — Reading source code, logs, error messages, configuration files
- **grep** — Searching codebase for relevant code, finding `[DEBUG-*]` tags during cleanup
- **write** — Creating test files, HITL scripts, harnesses, documentation
- **edit** — Applying fixes, adding/removing instrumentation
- **task** — Delegating sub-work (spawning subagents for parallel investigation)
- **question** — Presenting hypotheses to the user for veto, gathering HITL input

## Output

- **Root cause** identified and documented
- **Regression test** that fails before fix and passes after (runs in <100ms)
- **Fixed code** with all instrumentation removed
- **Clean codebase** — all `[DEBUG-*]` tags, temporary files, and harnesses removed
- **Architecture finding** (if 3-fail rule triggered) saved to `.agnes/learnings/`
- **Learnings document** in `.agnes/learnings/` describing root cause and fix

## Quality Criteria

- [ ] Feedback loop exists and is fast (<5s)
- [ ] Bug reproduces reliably
- [ ] Root cause identified and documented
- [ ] Regression test written (red before fix, green after)
- [ ] All `[DEBUG-*]` instrumentation removed
- [ ] Original repro no longer reproduces
- [ ] Architecture findings documented (if 3-fail rule triggered)

**Rationalization Table:**

| Excuse | Counter |
|--------|---------|
| "It should work" | Run it. Now. |
| "It passed yesterday" | Yesterday's weather. Run it now. |
| "Works on my machine" | Not a claim, find the environment diff |
| "I'll check later" | No. Check now or document as assumption |
| "The test must be wrong" | Prove it. Show why the test is wrong. |
| "This is a simple fix" | Famous last words. Debug first. |
| "I don't need to reproduce it" | You ALWAYS need to reproduce it. |

## When NOT to Use

- For simple, obvious bugs that debugger can resolve — griller is overkill for single-file, single-cause issues with clear symptom-to-source mappings
- When the bug cannot be reproduced at least 60% of the time after exhausting non-deterministic techniques — move on rather than spinning
- When the necessary architecture understanding or reproduction environment is unavailable (use explorer or setup tooling first)
- When the user expects a quick fix without systematic investigation — the griller is methodical by design

## Protocol Shells

All deep debugging follows the protocol shell format:

/protocol {
  intent="Stress-test hypotheses for a stubborn bug",
  input={ hypotheses="<attempted-fixes>", symptoms="<remaining-failures>" },
  process=[ /decompose{assumptions}, /trace{edge-cases}, /compare{explanations} ],
  output={ result="<root-cause>", eliminated="<ruled-out-hypotheses>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break assumptions into testable sub-hypotheses |
| /trace | Walk each execution path until divergence |
| /compare | Evaluate competing explanations against all symptoms |

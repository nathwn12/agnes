---
id: griller
name: griller
description: 'debugger has narrowed but not resolved, complex multi-file bugs with no clear hypothesis, recurring issues that were "fixed" before.'
phase: "DEBUG"
use_when: "debugger has narrowed but not resolved, complex multi-file bugs with no clear hypothesis, recurring issues that were \"fixed\" before."
version: 1.0
---

## Use When

debugger narrowed but not resolved, complex multi-file bugs, no clear hypothesis, recurring "fixed" issues.

## Core Concept

**Tone:** AGNES-led. Full control. Relentless, methodical.

Debugging is adversarial. Griller owns full cycle — fast feedback loop, ranked falsifiable hypotheses, instrument one variable at a time, fix with regression test proving root cause. 6-phase discipline is backbone. 3-fail rule: 3 wrong hypotheses → architecture wrong, not code.

**Backward Tracing Pattern:**

- Start at symptom (error, crash, wrong output)
- Trace data BACKWARD through each layer boundary
- At each boundary, add diagnostic instrumentation
- Ask: "What input to THIS layer produces this output?"
- Repeat to root cause layer

## Precise Vocabulary

- **Feedback loop:** Fast, deterministic pass/fail signal reproducing bug in 1 command
- **HITL (Human-In-The-Loop):** Bash script guiding human through manual repro, captures KEY=VALUE for agent parsing
- **Falsifiable hypothesis:** Ranked root cause prediction with "if true, then X" and exact test
- **Instrumentation:** Tagged debug logs `[DEBUG-<random4>]` for easy cleanup
- **Regression test:** Fails before fix (tests right thing), passes after (fix works), runs <100ms
- **3-Fail Rule:** 3 wrong hypotheses → stop, architecture is wrong — document, recommend redesign
- **Seam:** Architecture boundary where a test isolates a layer; determines regression test feasibility
- **Non-deterministic bug:** Unreliable repro; goal shifts to >60% repro via looping, parallelization, stress, delay injection

## Context Requirements

- Bug report/symptom (error, crash, wrong output, perf regression)
- debugger applied, narrowed but unresolved
- Access to codebase, test infra, repro environment
- HITL: collaborating human for scripted steps

## Workflow

### Phase 1: Build Feedback Loop

Fast, deterministic pass/fail signal:
- Failing test, curl, headless browser, throwaway harness
- Runnable in 1 command
- Clear pass/fail result
- Iterate: faster, sharper, more deterministic

**10 feedback loop strategies (ranked):**

1. **Failing test** — Fastest, most reliable. Red before fix, green after.
2. **curl / HTTP** — API/web bugs. Hit endpoint, assert response.
3. **CLI with known input** — CLI tools. Predetermined args, assert stdout/stderr/exit code.
4. **Headless browser** — UI bugs. Script nav, interaction, screenshot/assertion.
5. **Replay trace** — Record real session, replay deterministically.
6. **Throwaway harness** — 5-20 line script exercising buggy path only.
7. **Fuzz** — Random inputs, look for crashes.
8. **Bisection** — `git bisect` binary search through commits.
9. **Differential loop** — Run working + broken variant side by side, diff output.
10. **HITL bash script** — Last resort when full automation impossible.

**HITL bash script pattern:**

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

`step()` describes human action, `capture()` records structured responses. Outputs `KEY=VALUE`.

**Non-deterministic bug techniques:**

Goal: HIGHER repro rate (not clean repro):
- Loop 100x, measure frequency
- Parallelize for contention
- Add stress (memory, CPU, latency)
- Inject sleeps/delays at race points
- 50% flake = debuggable; 1% = not (move on)
- Add logging, slow ops, stress system — don't stop till ≥60% repro

### Phase 2: Reproduce

Run feedback loop, watch bug appear:
- Confirm RIGHT bug — matches user report
- Run ≥3 times confirm reproducibility
- Bug disappears? Document environment

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

Present to user for veto, execute top hypothesis.

### Phase 4: Instrument

One variable at a time:
- Tagged debug logs: `[DEBUG-<random4>]`
- Only instrumentation for current hypothesis
- Remove/disable previous before adding new
- Performance: baseline first, then bisect

### Phase 5: Fix + Regression Test

Before fix, write failing test reproducing bug:
- Correct seam: write failing test → apply fix → verify pass → re-run original repro
- No correct seam: document architecture gap

Regression test must:
- Fail before fix (proves right thing)
- Pass after fix (proves fix works)
- Run <100ms

### Phase 6: Cleanup

Remove all instrumentation:
- Grep `[DEBUG-*]` tags, remove all
- Remove temp test files and harnesses
- Confirm original bug no longer repros
- Confirm regression test passes
- Document root cause in `.agnes/learnings/`

### 3-Fail Rule

3 hypotheses wrong:
- Stop. Architecture wrong, not code.
- No 4th fix.
- Document what was tried and why each failed
- Recommend redesign or deeper investigation
- Save to `.agnes/learnings/` as architectural learning

### Performance Regression Specific

- Measure FIRST, fix second. No optimize without baseline.
- Profile before guessing bottlenecks.
- Compare before/after with statistical significance.
- One change at a time.

## Tool Requirements

- **bash** — Feedback loops, scripts, git bisect, CLI, test runners
- **read** — Source code, logs, errors, config
- **grep** — Codebase search, find `[DEBUG-*]` tags
- **write** — Test files, HITL scripts, harnesses, docs
- **edit** — Fixes, add/remove instrumentation
- **task** — Delegate sub-work (parallel investigation)
- **question** — Present hypotheses for veto, HITL input

## Output

- **Root cause** identified and documented
- **Regression test** fails before fix, passes after (<100ms)
- **Fixed code** with all instrumentation removed
- **Clean codebase** — all `[DEBUG-*]`, temp files, harnesses removed
- **Architecture finding** (if 3-fail rule) in `.agnes/learnings/`
- **Learnings document** in `.agnes/learnings/`

## Quality Criteria

- [ ] Feedback loop exists and fast (<5s)
- [ ] Bug reproduces reliably
- [ ] Root cause identified and documented
- [ ] Regression test (red before fix, green after)
- [ ] All `[DEBUG-*]` instrumentation removed
- [ ] Original repro no longer reproduces
- [ ] Architecture findings documented (if 3-fail rule)

**Rationalization Table:**

| Excuse | Counter |
|--------|---------|
| "It should work" | Run it. Now. |
| "It passed yesterday" | Yesterday's weather. Run it now. |
| "Works on my machine" | Not a claim, find env diff |
| "I'll check later" | No. Check now or document assumption |
| "The test must be wrong" | Prove it. Show why. |
| "This is a simple fix" | Famous last words. Debug first. |
| "I don't need to reproduce it" | You ALWAYS need to reproduce it. |

## When NOT to Use

- Simple, obvious bugs debugger can resolve
- Bug <60% repro after exhausting non-deterministic techniques
- Architecture understanding or repro environment unavailable (use explorer first)
- User expects quick fix without systematic investigation

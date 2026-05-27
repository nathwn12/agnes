---
id: griller
name: griller
description: 'debugger has narrowed but not resolved, complex multi-file bugs with no clear hypothesis, recurring issues that were "fixed" before.'
phase: "DEBUG"
use_when: "debugger has narrowed but not resolved, complex multi-file bugs with no clear hypothesis, recurring issues that were \"fixed\" before."
version: 1.0
---

# Griller

**Tradeoff:** Root-cause certainty costs 3-5x more context than quick fix. Use when debugger narrowed but stalled.

## Core

Own full debugging cycle: fast feedback loop → ranked falsifiable hypotheses → instrument one variable at a time → fix + regression test. 3-fail rule as safety valve.

**Backward Tracing:** Start at symptom → trace data flow BACKWARD through each layer boundary → add diagnostic instrumentation → ask "What input to THIS layer produces this output?" → repeat until root cause found.

## Vocabulary

- **Feedback loop:** Fast deterministic pass/fail signal reproducing bug in one command
- **HITL:** Bash script guiding human through manual repro, captures structured KEY=VALUE for agent parsing
- **Falsifiable hypothesis:** Ranked root cause prediction with specific "if true, then X" consequence and exact test
- **Instrumentation:** Tagged debug logs using `[DEBUG-<random4>]` pattern for easy cleanup
- **Regression test:** Fails before fix, passes after, runs in <100ms
- **3-Fail Rule:** Three wrong hypotheses → architecture wrong, not code → document + recommend redesign
- **Seam:** Architecture boundary where a test can isolate a layer
- **Non-deterministic bug:** Unreliable repro; goal → >60% repro rate via looping, parallelization, stress, delay injection

## Context

- Bug report or symptom description
- debugger applied but unresolved
- Codebase, test infra, repro environment access
- For HITL: collaborating human

## Workflow

### Phase 1: Build Feedback Loop

Fast deterministic pass/fail signal in one command. Iterate: faster, sharper → verify: loop <5s.

**10 strategies (ranked):**

1. **Failing test** — Fastest. Red before fix, green after.
2. **curl / HTTP request** — API/web bugs. Hit endpoint, assert response.
3. **CLI with known input** — Assert stdout/stderr/exit code.
4. **Headless browser** — UI bugs. Script interaction, assert.
5. **Replay trace** — Record real session, replay deterministically.
6. **Throwaway harness** — 5-20 line script exercising buggy path. No test framework.
7. **Fuzz** — Random inputs, look for crashes.
8. **Bisection** — `git bisect` through commits.
9. **Differential loop** — Run working vs broken side by side, diff output.
10. **HITL bash script** — Last resort when full automation impossible.

**HITL pattern:** `step()` describes human action, `capture()` records structured KEY=VALUE:
```
step() { echo "=== STEP: $* ===" >&2; }
capture() { echo "$1=$2" >> /tmp/hitl-output.txt; }
step "Open the app and navigate to settings"
read -p "What do you see? " result
capture "SETTINGS_PAGE" "$result"
```

**Non-deterministic bugs:** Goal >60% repro rate:
- Loop repro 100x, measure frequency
- Parallelize for contention, add stress, inject sleeps at race points
- 50% flake = debuggable; 1% = not
- → verify: repro rate >60%

**Output:** One-command pass/fail script reproducing the bug.

### Phase 2: Reproduce

Run feedback loop, confirm it's the RIGHT bug. Run ≥3x to confirm consistency → verify: 3/3. If disappears, document environment.

**Output:** Confirmed reproducible bug.

### Phase 3: Hypothesise

Generate 3-5 ranked falsifiable hypotheses:
```
Hypothesis 1 (60%): <cause>
  If true: <prediction>
  Test: <exact command>
```
Present to user for veto → verify: approved. Execute top.

**Output:** Ranked hypotheses, user-approved execution order.

### Phase 4: Instrument

One variable at a time. Tagged logs via `[DEBUG-<random4>]` for easy cleanup. Only instrumentation for current hypothesis. Remove previous before adding new. Performance: baseline first → verify.

**Output:** Targeted instrumentation matching hypothesis.

### Phase 5: Fix + Regression Test

If correct seam exists: write failing test → apply fix → verify pass → re-run original repro. If no seam: document architecture gap. Regression test: fail before, pass after, <100ms → verify.

**Output:** Regression test (red/green) + fixed code.

### Phase 6: Cleanup

Grep `[DEBUG-*]` tags, remove all → verify: zero remain. Remove temp files, harnesses. Confirm original bug gone → verify. Confirm regression test passes.

**Output:** Clean codebase + root cause in `.agnes/learnings/`.

### 3-Fail Rule

Three wrong hypotheses → stop. Architecture wrong, not code. No 4th fix. Document what was tried, why each failed → verify: saved to `.agnes/learnings/`. Recommend redesign.

### Performance Regression

Measure first, fix second → verify: baseline exists. Profile before guessing. One change at a time. Statistically significant before/after comparison.

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| bash | 1,2,4,5,6 | Feedback loops, scripts, bisect | Pass/fail, measurement, repro |
| read | 2,4,6 | Source, logs, config | Context for hypotheses |
| grep | 1,4,6 | Codebase, [DEBUG-*] tags | Relevant code, tag count |
| write | 1,5,6 | Tests, HITL scripts, harnesses | Feedback loop, regression test |
| edit | 4,5 | Instrumentation, fix | Modified source |
| task | 3,4,5 | Parallel investigation | Narrowed per sub-task |
| question | 3,5 | Hypothesis veto, HITL input | User-approved direction |

## Examples

| Scenario | Approach | Verify |
|----------|----------|--------|
| API 500 for valid input | curl → hypothesis: middleware rejects token → instrument auth | Token expiry comparison `<=` vs `<` |
| UI flickers on route change | Headless browser → hypothesis: race in state init → timing logs | State reset after render, not before |
| Intermittent DB timeout in CI | Loop 100x → hypothesis: pool exhaustion | Pool size = 1, needs N+1 |
| Crash on user upload | Fuzz → hypothesis: invalid EXIF handler → git bisect | EXIF parsing commit regression |
| "Fixed" bug reappears | Old test passes → write new repro | Old test missed edge case |

## Output

- **Root cause** identified and documented
- **Regression test** failing before fix, passing after (<100ms)
- **Fixed code** with instrumentation removed
- **Clean codebase** — all `[DEBUG-*]` tags, temp files removed
- **Architecture finding** (3-fail rule triggered) in `.agnes/learnings/`
- **Learnings document** in `.agnes/learnings/`

## Quality Criteria

- → verify: feedback loop exists, <5s
- → verify: bug reproduces reliably (3/3 or >60% for non-deterministic)
- → verify: root cause documented in `.agnes/learnings/`
- → verify: regression test written (red before, green after)
- → verify: all `[DEBUG-*]` instrumentation removed
- → verify: original repro no longer fails
- → verify: architecture findings documented (if 3-fail rule)

**Rationalization Table:**

| Excuse | Counter |
|--------|---------|
| "It should work" | Run it. Now. |
| "It passed yesterday" | Yesterday's weather. Run it now. |
| "Works on my machine" | Not a claim. Find env diff. |
| "I'll check later" | No. Check now or document assumption. |
| "The test must be wrong" | Prove it. Show why. |
| "This is a simple fix" | Famous last words. Debug first. |
| "I don't need to reproduce" | You ALWAYS need to reproduce it. |

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break assumptions into testable sub-hypotheses |
| /trace | Walk each execution path until divergence |
| /compare | Evaluate competing explanations against all symptoms |

Protocol shell: `/protocol {intent, input={hypotheses, symptoms}, process=[/decompose, /trace, /compare], output={result, eliminated}}`

## Skip When

- debugger can resolve (simple single-cause bugs)
- Bug cannot reproduce >60% after exhausting non-deterministic techniques
- Architecture understanding or repro environment unavailable (use explorer first)
- User expects quick fix without systematic investigation

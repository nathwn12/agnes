---
id: debugger
name: debugger
description: 'User says "this is broken, help me figure out why", error reports without clear root cause, performance regressions needing investigation.'
phase: "DEBUG"
use_when: "User says \"this is broken, help me figure out why\", error reports without clear root cause, performance regressions needing investigation."
version: 1.2
---

**Tradeoff:** Systematic debugging catches root causes reliably but slower than guessing. Skip trivial single-file bugs with obvious fixes.

## Core Concept

**Iron Law:** No fixes without root cause investigation. Symptom fixes fail.
7-step loop: Reproduce → Explore → Hypothesise → Ask → Instrument → Narrow → Fix + Document. User partner at every decision point.

## Precise Vocabulary

- **Hypothesis**: Falsifiable, ranked statement naming module with disproof method.
- **Instrumentation**: Targeted logging/assertions with tagged markers (e.g. `[DEBUG-a4f2]`).
- **Narrowing**: Sequential elimination of hypotheses, one variable at a time.
- **Reproduction**: Confirming bug with exact steps, input, environment, expected vs actual.
- **Root Cause**: Minimal underlying fault — one sentence. Trace to original trigger.
- **Falsifiable**: Provable wrong by specific experiment.
- **Feedback Loop**: Fast deterministic agent-runnable pass/fail signal.
- **Defense-in-Depth**: Validation at every layer data passes through.
- **Bisection**: Systematic narrowing by halving search space.

## Context Requirements

- Source code access, git history, error logs, stack traces
- Ability to run code and add instrumentation
- User availability for clarifying questions (one at a time)

## Workflow

### Phase 0: Build Feedback Loop (Critical)

Before any hypothesis or fix, build fast deterministic agent-runnable pass/fail signal.

Methods (try order): 1. Failing test at seam  2. Curl/HTTP script  3. CLI with fixture  4. Headless browser  5. Replay captured trace  6. Throwaway harness  7. Property/fuzz loop (1000 inputs)  8. Bisection harness  9. Differential loop (old vs new).

→ verify: Loop deterministic, runs <10s. Non-deterministic: loop 100x, parallelise. Can't build? Ask for reproducing environment, captured artifact (HAR/log dump/core dump), or temp production instrumentation.

### Phase 1: Reproduce

Run loop. Confirm user-described failure mode, reproducible, exact symptom. → verify: Bug reproduces consistently.

### Phase 2: Explore

Examine code, recent changes (`git log --oneline -20`), error logs, stack traces. Multi-component: add diagnostic instrumentation at each boundary first. Find WHERE it breaks.

**Root cause tracing:** Bugs manifest deep in call stack. Trace backward to original trigger. Fix at source. If manual trace fails: `console.error('DEBUG:', { directory, cwd, stack: new Error().stack })`.

→ verify: State component/module where fault originates.

### Phase 3: Hypothesise

Generate **3-5 ranked hypotheses before testing any**. Each falsifiable: "If <X> is cause, then <changing Y> makes bug disappear." Must be Specific (module), Falsifiable (testable), Ranked (by likelihood). Show user before testing. → verify: Clear testable prediction per hypothesis.

### Phase 4: Ask User

Present hypotheses. **One question at a time.** User guides testing order. Proceed if AFK. → verify: User acknowledged first hypothesis.

### Phase 5: Instrument

Add targeted logging/assertions, one variable at a time. Each probe maps to a hypothesis. Preference: Debugger/REPL > targeted logs boundaries > never "log everything and grep".

**Tag every debug log** with unique prefix (e.g. `[DEBUG-a4f2]`). Cleanup = one grep. **Performance regressions:** Baseline measurement first.

→ verify: Instrumentation maps to one hypothesis. Logs tagged.

### Phase 6: Narrow

Share findings, repeat until root cause found. Eliminate hypotheses sequentially. 3 rounds no root cause? <3 fixes → return Phase 2. ≥3 → handoff to griller. → verify: Each round eliminates ≥1 hypothesis.

### Phase 7: Fix + Regression Test

Write regression test **before fix** — only if correct seam exists.

If seam exists:
1. Repro → failing test → verify: fails
2. Apply fix (ONE change) → verify: passes
3. Re-run Phase 0 loop → verify: bug gone
4. Full test suite → verify: no regressions

**No correct seam?** Flag for architecture improvement.

**Defense-in-depth:** After fix, add validation at every layer. Make bug structurally impossible.

→ verify: Fix minimal, test covers bug pattern, defense-in-depth applied.

### Phase 8: Document

```markdown
## Bug: [Title]
### Root Cause
[One sentence]
### Reproduction
1. Step 1 | 2. Step 2
### Fix
[PR/commit ref]
### Defense Added
[Validation layers preventing recurrence]
```

What would have prevented this? Hand off to architect.
→ verify: All `[DEBUG-...]` tags cleaned. Bug report with one-sentence root cause.

## Flow Diagram

```
[symptom] → [feedback loop] → [reproduce] → [explore] → [hypothesise] → [ask user] → [instrument] → [narrow] → [fix + test] → [document]
                  │                                                                        │          │
                  └─────────────────────────────────────────────────────────────────────────┘          │
                                                                                             ↑ failed   │
                                                                                             └───────────┘ → [architecture finding]
```

## Tools

| Tool | Phase | Input | Output |
|------|-------|-------|--------|
| `git` | P1-P3, P7 | commit range, files | diff, blame, bisect window |
| `logging` | P5-P6 | hypothesis prediction | tagged markers `[DEBUG-XXXX]` |
| debugger/REPL | P5 | breakpoint | variable state, stack trace |
| explorer | P2 | affected module | code paths, boundary evidence |
| griller | P6 (≥3 fails) | narrowing history | adversarial root cause |

## Examples

| Scenario | Without | With Debugger |
|----------|---------|---------------|
| Auth 401 after deploy | Guess at config | Curl loop → narrow to token expiry → fix |
| List renders no data | Log entire response | Boundary check: component → API → DB — missing column |
| Build fails only on CI | Reinstall node_modules | `git bisect` → pin package 3 commits back |

## Quality Criteria

- Feedback loop built before hypotheses/fixes → verify
- One question at a time → verify
- Each hypothesis specific, falsifiable, ranked → verify
- Debug logs tagged with unique markers → verify
- User consulted at every decision point → verify
- Regression test before fix (when seam exists) → verify
- Defense-in-depth at every layer after fix → verify
- All tagged instrumentation removed → verify

## Skip When

- No reproduction steps and user cannot provide them
- Bug in third-party dependency with no workaround — report upstream
- 3 rounds narrowing no root cause — handoff to griller
- User asking for architectural improvement, not specific bug

## Protocol Shells

/protocol {
  intent="Find root cause",
  input={ symptom="<error-or-behavior>", reproduction="<steps>" },
  process=[ /decompose{hypotheses}, /trace{execution}, /verify{root-cause} ],
  output={ result="<root-cause>", evidence="<stack-or-log>", fix="<proposed-change>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break failure into independent hypotheses |
| /trace | Walk execution path step-by-step to divergence point |
| /verify | Check hypothesized root cause explains all symptoms |

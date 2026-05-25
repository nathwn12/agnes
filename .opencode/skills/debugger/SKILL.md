---
id: debugger
name: debugger
description: 'User says "this is broken, help me figure out why", error reports without clear root cause, performance regressions needing investigation.'
phase: "DEBUG"
use_when: "User says \"this is broken, help me figure out why\", error reports without clear root cause, performance regressions needing investigation."
version: 1.1
---

## Use When

User says "this is broken, help me figure out why", error reports without clear root cause, performance regressions needing investigation.

## Core Concept

**The Iron Law:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST. Symptom fixes are failure. Random fixes waste time and create new bugs. Quick patches mask underlying issues.

Structured 7-step collaborative debugging loop: Reproduce → Explore → Hypothesise → Ask → Instrument → Narrow → Document. The user is a partner at every decision point — hypotheses are presented for guidance, findings are shared immediately, and no step advances without user awareness.

## Precise Vocabulary

- **Hypothesis**: A falsifiable, specific, ranked statement about the root cause. Must name the module and define how to disprove it.
- **Instrumentation**: Targeted logging or assertions with tagged markers (e.g. `[DEBUG-a4f2]`) for easy cleanup.
- **Narrowing**: Sequential elimination of hypotheses by instrumenting one variable at a time.
- **Reproduction**: Confirming the bug with the user's exact steps, input, environment, and expected vs actual behavior.
- **Root Cause**: The minimal underlying fault — one sentence. Never fix at the symptom — trace backward to the original trigger.
- **Falsifiable**: Can be proven wrong by a specific experiment. If you cannot state the prediction, the hypothesis is a vibe — discard or sharpen it.
- **Feedback Loop**: A fast, deterministic, agent-runnable pass/fail signal for the bug. The most important debugging tool.
- **Defense-in-Depth**: Adding validation at every layer data passes through to make the bug structurally impossible.
- **Bisection**: Systematic narrowing by halving the search space (commit range, input dataset, timing window).

## Context Requirements

- Access to source code and relevant files
- Git history for recent changes (`git log --oneline -20`)
- Error logs, stack traces, or console output
- Ability to run code and add instrumentation
- User availability to answer clarifying questions (one at a time)

## Workflow

### Phase 0: Build a Feedback Loop (Critical)

Before any hypothesis or fix, build a fast, deterministic, agent-runnable pass/fail signal for the bug. Spend disproportionate effort here. If you have a good loop, bisection, hypothesis-testing, and instrumentation all consume it. If you don't, no amount of staring at code will save you.

Ways to construct one (try in this order):
1. **Failing test** at whatever seam reaches the bug — unit, integration, e2e
2. **Curl / HTTP script** against a running dev server
3. **CLI invocation** with fixture input, diff stdout against known-good snapshot
4. **Headless browser script** (Playwright) — drives UI, asserts on DOM/console/network
5. **Replay captured trace** — save real request/payload/event to disk, replay through isolated code path
6. **Throwaway harness** — minimal subset of system exercising the bug path with a single function call
7. **Property / fuzz loop** — 1000 random inputs to find the failure mode
8. **Bisection harness** — automate "boot at state X, check, repeat" for git bisect run
9. **Differential loop** — run same input through old vs new version, diff outputs

**Iterate on the loop itself.** Once you have one, ask: Can I make it faster? Can I make the signal sharper? Can I make it more deterministic? A 30-second flaky loop is barely better than nothing. A 2-second deterministic loop is a debugging superpower.

**For non-deterministic bugs:** Goal is not a clean repro but a higher reproduction rate. Loop the trigger 100x, parallelise, add stress, inject sleeps. A 50%-flake bug is debuggable; 1% is not.

**When you genuinely cannot build a loop:** Stop and say so explicitly. List what you tried. Ask the user for: access to whatever environment reproduces it, a captured artifact (HAR file, log dump, core dump), or permission to add temporary production instrumentation.

Do not proceed to Phase 1 until you have a loop you believe in.

### Phase 1: Reproduce

Run the loop. Watch the bug appear. Confirm:
- [ ] The loop produces the failure mode the user described — not a different failure nearby
- [ ] Failure is reproducible across multiple runs (or at high enough rate for non-deterministic)
- [ ] Exact symptom captured (error message, wrong output, timing) so later phases can verify the fix

### Phase 2: Explore

Look at relevant code, recent changes, and error logs:
- Check recent commits: `git log --oneline -20`
- Read the relevant source files
- Look for error logs, stack traces, or console output
- Check for known issues or recent dependency changes
- Use explorer patterns to understand the affected area
- For multi-component systems: add diagnostic instrumentation at each component boundary before proposing fixes. Log what enters and exits each component. Verify environment/config propagation. Gather evidence showing WHERE it breaks, then investigate that specific component.

**Root cause tracing:** Bugs often manifest deep in the call stack. Trace backward through the call chain until you find the original trigger. Ask: What code directly causes this? What called that? What value was passed? Where did that value come from? Keep tracing up until you find the source. Fix at source, not at symptom. If you can't trace manually, add stack trace instrumentation: `console.error('DEBUG:', { directory, cwd, stack: new Error().stack })`.

### Phase 3: Hypothesise

Generate **3-5 ranked hypotheses before testing any of them**. Single-hypothesis generation anchors on the first plausible idea. Each hypothesis must be falsifiable: state the prediction it makes.

Format: "If <X> is the cause, then <changing Y> will make the bug disappear."

Each hypothesis must be:
- Specific — "the X module" not "somewhere in the code"
- Falsifiable — "changing Y will make the bug disappear"
- Ranked — by likelihood, not wishful thinking

Show the ranked list to the user before testing. They often have domain knowledge that re-ranks instantly ("we just deployed a change to #3").

### Phase 4: Ask User

Present hypotheses to the user. One question at a time — never two. Let them guide which to test first.

> "Here are my top hypotheses. Which should I start with? Or do you have a different theory?"

Don't block on it — proceed with your ranking if the user is AFK.

### Phase 5: Instrument

Add targeted logging or assertions, one variable at a time. Each probe must map to a specific prediction from Phase 3. Change one variable at a time.

Tool preference:
1. **Debugger / REPL inspection** — one breakpoint beats ten logs
2. **Targeted logs** at the boundaries that distinguish hypotheses
3. Never "log everything and grep"

**Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup at the end becomes a single grep. Untagged logs survive; tagged logs die.

**For performance regressions:** Establish a baseline measurement (timing harness, `performance.now()`, profiler, query plan) first, then bisect. Logs are usually wrong for performance. Measure first, fix second.

### Phase 6: Narrow

Share findings, ask the next question, repeat until root cause found. Use the narrowing process to eliminate hypotheses. After each instrumentation round, verify the finding before moving on.

If after 3 rounds of narrowing the root cause is still unclear, STOP. Count how many fixes you've attempted. If < 3, return to Phase 2 with new information. If ≥ 3, stop and question the architecture — 3+ failed fixes with no progress indicates a structural problem, handoff to griller for adversarial debugging.

### Phase 7: Fix + Regression Test

Write the regression test **before the fix** — but only if there is a correct seam for it. A correct seam is one where the test exercises the real bug pattern as it occurs at the call site.

If a correct seam exists:
1. Turn the minimised repro into a failing test at that seam
2. Watch it fail
3. Apply the fix (ONE change at a time — no bundled refactoring)
4. Watch it pass
5. Re-run the Phase 0 feedback loop against the original scenario
6. Run the full test suite to verify no regressions

If no correct seam exists, that itself is the finding. Note it and flag for architecture improvement later.

**Defense-in-depth:** After fixing, trace the data flow and add validation at every layer data passes through: entry point validation (reject obviously invalid input), business logic validation (ensure data makes sense for this operation), environment guards (prevent dangerous operations in specific contexts), and debug instrumentation (capture context for forensics). Make the bug structurally impossible, not just fixed.

### Phase 8: Document

Record root cause and reproduction steps:
```markdown
## Bug: [Title]

### Root Cause
[One sentence]

### Reproduction
1. Step 1
2. Step 2

### Fix
[Description or reference to the fix PR/commit]

### Defense Added
[What validation layers were added to prevent recurrence]
```

Also note: what would have prevented this bug? If the answer involves architectural change (no good test seam, tangled callers, hidden coupling), hand off to the architect skill.

## Tool Requirements

- **git**: Check recent commits and changes, bisect regression windows
- **logging**: Add tagged instrumentation markers for targeted debugging
- **explorer**: Use explorer patterns to understand affected code areas
- **hypothesis-testing**: Propose and rank falsifiable hypotheses by probability
- **feedback-loop**: Build and iterate on a fast deterministic pass/fail signal
- **griller**: Handoff for adversarial debugging when 3+ narrowing rounds yield no progress

## Output

Bug report with root cause (one sentence), reproduction steps, fix reference, and defense-in-depth summary. Clean up all `[DEBUG-...]` instrumentation before declaring done.

## Quality Criteria

- Feedback loop built and iterated before any hypotheses or fixes
- One question asked at a time — never two
- Each hypothesis is specific, falsifiable, and ranked by likelihood
- Debug logs tagged with unique markers for cleanup
- User is consulted at every decision point before proceeding
- Findings shared immediately after each instrumentation round
- Regression test written before fix (when a correct seam exists)
- Defense-in-depth validation added at every layer after fixing
- All tagged instrumentation removed before completion

## When NOT to Use

- No reproduction steps available and user cannot provide them
- Bug is in a third-party dependency with no workaround — report upstream instead
- If after 3 rounds of narrowing the root cause is still unclear, handoff to griller for adversarial debugging
- User is asking for architectural improvement, not a specific bug diagnosis

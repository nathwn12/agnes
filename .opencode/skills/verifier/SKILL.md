---
id: verifier
name: verifier
description: 'After any code change (called by builder), before claiming any task is complete, before shipper starts.'
phase: "VERIFY"
use_when: "After any code change (called by builder), before claiming any task is complete, before shipper starts. Also when a Definition of Done contract with evidence-backed assertions must be verified before completion can be claimed."
version: 1.1
---

## Use When

After any code change (called by builder), before claiming task complete, before shipper starts.

## Core Concept

> **NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE**

Evidence before assertions. Trusting "should work" or previous runs is dishonesty, not efficiency.

## Precise Vocabulary

- **Verification Gate**: Ordered checks (Type Check, Lint, Test, Build, Promise Scan, Evidence Capture) that must all pass before claiming completion
- **Type Check**: Static type analysis via `tsc --noEmit` or `bun run typecheck`; zero errors required
- **Lint**: Code quality via project linter; zero errors, warnings captured separately
- **Test**: Automated test suite; any failure blocks gate
- **Build**: Production compilation; must produce output without errors
- **Promise Scan**: Searches subagent output for `<promise>TAG</promise>` markers; tag must match expected
- **Evidence**: Full captured output from each step, logged as structured pass/fail with timing and metrics
- **Rationalization**: Excuse to defer/skip fresh verification — all rejected by Iron Law
- **Contract**: Declarative set of testable assertions encoding Definition of Done. Each assertion is promise with evidence requirement.
- **Definition of Done (DoD)**: Complete conditions (all assertions passed, all evidence captured) before task can complete. Failing/pending assertion without evidence blocks gate.

## Context Requirements

- Project type (determines verification commands)
- Project tool chain: TS compiler, linter, test runner, build tool
- CI pipeline config — verification order consistent across local and CI

## Workflow

Run in order. Stop on first failure unless specified.

### 1. Type Check

Command: `tsc --noEmit` or `bun run typecheck`
- Zero errors
- Capture full output

### 2. Lint

Command: `bun run lint` or project linter
- Zero errors
- Capture warnings separately
- If lint-fix available, run it

### 3. Test

Command: `bun run test` or project test runner
- Capture: suites passed/failed, total tests, individual failures
- Failing test blocks gate
- Capture full output

### 4. Build

Command: `bun run build` or project build
- No errors
- Verify output file exists, expected size

### 5. Promise Scan

Scan subagent output for `<promise>` tag:
- Pattern: `<promise>EXPECTED_TAG</promise>` (default: `DONE`)
- Regex: `/<promise>\s*EXPECTED_TAG\s*<\/promise>/i`
- Match → PASS. Unexpected tag → FAIL (log it). No tag → FAIL.
- Capture tag value as evidence

### 5.5 Contract / Definition of Done

When task specifies DoD contract:

- Each assertion: evidence-backed status: `passed`, `failed`, or `pending`
- Evidence references actual command output (stdout, exit codes, file content, test results) — never subjective
- Any `failed` assertion blocks gate. Document: assertion name, expected, actual, disproving evidence
- Any `pending` assertion blocks gate — task incomplete
- Promise tag verified as final assertion
- Collect evidence per-assertion in Evidence Capture

### 6. Evidence Capture

Log actual output:
```
Type check: PASS (0 errors, 2.1s)
Lint: PASS (0 errors, 0 warnings, 1.5s)
Test: PASS (24 tests, 3 suites, 0.8s)
Build: PASS (output: dist/index.js, 156KB)
Promise:  PASS (<promise>DONE</promise>)
Contract: PASS (3/3 assertions passed, all evidence attached)
```

## Tool Requirements

- **Bash**: Execute verification commands, capture output
- **Read**: Examine captured output, verify build artifact details

## Output

Structured verification evidence log after all gates pass:

```
Type check: PASS (0 errors, 2.1s)
Lint: PASS (0 errors, 0 warnings, 1.5s)
Test: PASS (24 tests, 3 suites, 0.8s)
Build: PASS (output: dist/index.js, 156KB)
Promise:  PASS (<promise>DONE</promise>)
Contract: PASS (3/3 assertions passed, all evidence attached)
```

Any gate fails → output failure details, stop. Don't continue to subsequent gates.

## Quality Criteria

- All gates pass zero errors before claiming completion
- Evidence freshly captured in current session — previous runs don't count
- Every gate outcome logged with actual metrics (timing, counts, sizes)
- Rationalization Guard Table enforced:

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "It passed yesterday" | Run it NOW in this session |
| "Just this once" | No exceptions |
| "The test isn't important" | Remove it or fix it |
| "I'll check later" | Check now or document why not |
| "All assertions feel right" | Show me command evidence |
| "It's probably done" | Run contract assertions |

## Named Subagent Roles — @executor

### @executor for Verification

Verifier delegates ALL bash to @executor. Verifier NEVER runs bash directly.

@executor runs verification commands (tests, builds, type checks, linters) → returns compact pass/fail. Verifier:
1. Specifies exact command(s)
2. Reads @executor's compact result
3. Makes pass/fail/blocked determination
4. Documents result with file:line references for failures

@executor doesn't interpret — executes and reports. Verifier retains full responsibility for analysis and documentation.

Prefer:
- `--quiet` or `--short` flags for compact output
- JSON output format when available
- Smallest command answering verification question before broader checks

## When NOT to Use

- No automated checks exist — use manual verification
- Designing/writing tests — use tester instead
- Initial project scaffolding before CI configured
- Investigating/fixing test failures rather than gating completion claim

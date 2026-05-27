---
id: verifier
name: verifier
description: 'After any code change (called by builder), before claiming any task is complete, before shipper starts.'
phase: "VERIFY"
use_when: "After any code change (called by builder), before claiming any task is complete, before shipper starts. Also when a Definition of Done contract with evidence-backed assertions must be verified before completion can be claimed."
version: 1.2
---

# Verifier

**Tradeoff:** Thorough gate sequence (typecheck → lint → test → build → promise scan) catches regressions but costs time. Skipping gates speeds up iteration but risks shipping broken code. Run full gate before any completion claim. Shallow-first within each gate — prefer `--quiet`/JSON output, escalate to full output only on failure.

## Use When

After any code change (called by builder), before claiming any task is complete, before shipper starts.

## Core Concept

> **NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE**

Evidence before assertions. "Should work" is dishonesty, not efficiency.

## Precise Vocabulary

- **Verification Gate**: ordered checks (Type Check → Lint → Test → Build → Promise Scan → Evidence Capture) — all must pass
- **Type Check**: `tsc --noEmit` or equivalent; zero errors required
- **Lint**: project linter; zero errors required, warnings logged separately
- **Test**: test suite runner; any failure blocks gate
- **Build**: production compilation; zero errors, output artifact verified
- **Promise Scan**: grep subagent output for `<promise>TAG</promise>` marker
- **Evidence**: captured full output per step — structured pass/fail + timing + metrics
- **Rationalization**: any excuse to skip fresh verification — all rejected
- **Contract**: declarative testable assertions encoding Definition of Done; each assertion requires command-evidence to pass
- **DoD**: complete set of conditions (all assertions passed + evidence captured) before task is complete

## Context Requirements

- Project type → determines command selection
- Tool chain: TypeScript compiler, linter, test runner, build tool
- CI config (if exists) — verification ordering must match local and CI

## Workflow

Run in order. Stop on first failure.

### 1. Type Check
`tsc --noEmit` or `bun run typecheck`
→ verify: exit 0, zero errors, capture output

### 2. Lint
`bun run lint` or project linter
→ verify: exit 0, zero errors, log warnings separately
If `--fix` available, run it before checking

### 3. Test
`bun run test` or project test runner
→ verify: exit 0, all suites passed, capture failure details
[Test] → verify: suite count + pass count + fail count captured

### 4. Build
`bun run build` or project build command
→ verify: exit 0, artifact exists, size logged
[Build] → verify: dist output present, non-zero size

### 5. Promise Scan
Scan subagent output for `<promise>EXPECTED_TAG</promise>`
Default tag: `DONE`. Regex: `/<promise>\s*EXPECTED_TAG\s*<\/promise>/i`
→ verify: tag present with expected value

### 5.5 Contract / Definition of Done
When task has a DoD contract, verify each assertion against evidence:
- Each assertion status: `passed`, `failed`, or `pending` — backed by command output
- `failed` → block gate. Document: assertion name, expected, actual, disproving evidence
- `pending` → block gate (task incomplete)
- Final assertion: `<promise>EXPECTED_TAG</promise>` match
→ verify: all assertions PASS with evidence attached

### 6. Evidence Capture
Log actual output, not intent:
```
Type check: PASS (0 errors, 2.1s)
Lint: PASS (0 errors, 0 warnings, 1.5s)
Test: PASS (24 tests, 3 suites, 0.8s)
Build: PASS (output: dist/index.js, 156KB)
Promise:  PASS (<promise>DONE</promise>)
Contract: PASS (3/3 assertions passed, all evidence attached)
```
→ verify: evidence log complete, all entries PASS

**Phase output:** Structured evidence log with PASS/FAIL per gate, timing, and metrics.

## Flow Diagram

```
Type Check ──► Lint ──► Test ──► Build ──► Promise Scan ──► Evidence Capture
    │            │         │          │            │                │
    ▼            ▼         ▼          ▼            ▼                ▼
   PASS         PASS      PASS       PASS         PASS             DONE
    │            │         │          │            │                │
    └───── FAIL: stop, report first failure ───────┘
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| Bash | All | shell command | stdout + stderr + exit code |
| Read | Evidence Capture | captured log file | verified content |
| Write | Evidence Log | structured log | `.agnes/evidence/` entry |

## Examples

| Scenario | Command | Expected | Actual | Verdict |
|----------|---------|----------|--------|---------|
| Type check passes | `tsc --noEmit` | exit 0, 0 errors | exit 0, 0 errors | PASS |
| Lint has warnings | `bun run lint` | exit 0, 0 errors | exit 0, 2 warnings | PASS (warnings logged) |
| Test fails | `bun run test` | exit 0 | exit 1, 1 suite failed | FAIL — block gate |
| Build missing | `bun run build` | dist/bundle.js exists | file not found | FAIL — block gate |
| Promise missing | grep subagent output | `<promise>DONE</promise>` | no match | FAIL — task not complete |
| Contract 3/3 pass | all assertion commands | 3 passed | 3 passed, evidence attached | PASS |

## Output

```
Type check: PASS (0 errors, 2.1s)
Lint: PASS (0 errors, 0 warnings, 1.5s)
Test: PASS (24 tests, 3 suites, 0.8s)
Build: PASS (output: dist/index.js, 156KB)
Promise:  PASS (<promise>DONE</promise>)
Contract: PASS (3/3 assertions passed, all evidence attached)
```

Any gate fails → output failure details, stop, do not proceed.

## Quality

- All gates PASS with zero errors before completion claim
- Evidence captured fresh in current session — no cached results
- Every gate logged with actual metrics (timing, counts, sizes)
→ verify: evidence freshness confirmed
→ verify: all gates exited 0
→ verify: promise tag matches expected value
→ verify: no rationalizations accepted

Rationalization Guard Table:

| Excuse | Reality |
|--------|---------|
| "Should work" | RUN the verification |
| "Passed yesterday" | Run it NOW |
| "Just this once" | No exceptions |
| "Test isn't important" | Remove or fix it |
| "I'll check later" | Check now or document why |
| "Feels right" | Show command evidence |
| "Probably done" | Run contract assertions |

## Protocol Shells

```
/protocol {
  intent="Verify code change meets correctness and quality criteria",
  input={ change="<diff-or-file>", criteria="<verification-checks>" },
  process=[ /verify{correctness}, /verify{regression}, /synthesize{verdict} ],
  output={ result="<pass-fail>", evidence="<specific-evidence>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break verification into independent checks |
| /verify | Check each criterion with specific evidence from output |
| /synthesize | Combine check results into verified/blocked verdict |

## When NOT to Use

- No automated checks exist — use manual verification instead
- Designing or writing tests — use tester instead
- Initial project scaffolding before CI pipeline
- Investigating/fixing test failures (not gating a completion claim)

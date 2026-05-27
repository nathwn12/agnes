---
id: tester
name: tester
description: 'After builder completes implementation. When user reports bugs (write regression test first). Before shipping (final test gate). For test coverage audits.'
phase: "TEST"
use_when: "After builder completes implementation. When user reports bugs (write regression test first). Before shipping (final test gate). For test coverage audits."
version: 1.0
---

# tester

**Tradeoff:** Fast validation vs. thorough coverage. Regression tests prove bugs stay fixed but slow iteration. Integration tests catch cross-module bugs at higher maintenance cost. Type tests prevent category errors on generic code.

## Core Concept

Five-test hierarchy — unit, integration, edge case, regression, type — with coverage gap analysis. Systematic discipline, not firefighting.

## Precise Vocabulary

- **Unit Tests**: Function/component level, isolated with mocked deps.
- **Integration Tests**: Cross-module at API routes, DB calls, service layers.
- **Edge Cases**: Boundaries — empties, max values, error paths, concurrency, type coercion.
- **Regression Tests**: Written before fix, fail before, pass after.
- **Type Tests**: `expectTypeOf` verification of TS types, inference, and error surfaces.
- **Coverage Gap**: Areas lacking coverage, tracked by module with risk level.
- **QA Patterns**: Coverage maps + "What Could Break?" analysis.

## Context Requirements

- Project test framework and conventions
- Modules/components under test
- Bug repro steps (regression)
- Assumptions the code makes

## Workflow

### 1. Coverage Map
Map modules to test types needed:

| Module | Unit | Integration | Edge Cases |
|--------|------|-------------|------------|
| auth   | ✓    | ✓          | token expiry, invalid tokens |
| api    | ✓    | ✗          | rate limiting, pagination |

→ `verify:` Each module has at least unit coverage mapped.

### 2. Unit Tests
Test each public function/component in isolation with mocked deps. Cover happy path, error cases, boundary values. Follow project conventions.

→ `verify:` All public functions have unit test cases.
→ `verify:` Mock usage matches project patterns.

### 3. Integration Tests
Test cross-module at integration points. Use real/in-memory implementations where practical.

→ `verify:` Each API route has integration test.
→ `verify:` DB/service layer interactions covered.

### 4. Edge Cases
Systematic boundaries: empty states, max values, error paths, concurrency, type coercion.

→ `verify:` Empty/null/undefined handled per function.
→ `verify:` Error paths exercised.
→ `verify:` Type coercion inputs tested.

### 5. Regression Tests
Write test reproducing the bug before fixing. Must fail before fix, pass after. Keep minimal.

→ `verify:` Test fails on original code.
→ `verify:` Test passes on fixed code.
→ `verify:` Test is simplest possible reproduction.

### 6. Type Tests
For complex generic code: verify types with `expectTypeOf`. Test type errors on invalid usage and correct inference on valid usage.

→ `verify:` Generic function types surface errors for invalid args.
→ `verify:` Inference produces expected types for valid usage.

### 7. "What Could Break?" Analysis
For each change: what assumptions, what breaks those assumptions, what changes in deps, what prod scenarios differ from tests.

→ `verify:` Assumptions documented per module.
→ `verify:` Dep analysis complete.

### 8. Coverage Gap Report
Total tests written, coverage by module, gaps with risk levels, recommendations.

→ `verify:` Every module has risk-assessed coverage entry.

## Flow

```
Coverage Map → Unit Tests → Integration Tests → Edge Cases
                         ↓
               Regression Tests (per bug)
                         ↓
                  Type Tests (generics)
                         ↓
           ┌─ "What Could Break?" Analysis
           ↓
      Coverage Gap Report
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| test runner | all | test files | pass/fail counts |
| expectTypeOf | type tests | generic types | type assertion result |
| coverage tool | report | run results | coverage % by module |

## Examples

| Scenario | Test Type | Approach |
|----------|-----------|----------|
| Auth token expiry | Unit + Edge | Mock timer, test boundary |
| API pagination page size | Integration | Hit endpoint, verify shape |
| Fix: rate limit overflow | Regression | Write failing test, fix, verify |
| Generic `useList` hook | Type | expectTypeOf invalid/valid usage |

## Output

```
PASS  tests/auth.test.ts (12 tests)
PASS  tests/api.test.ts (8 tests)
Test Suites: 2 passed, 2 total
Coverage: auth=100%, api=85%
Gaps: db layer (medium risk)
```

## Quality

→ `verify:` All tests pass (unit, integration, edge, regression, type).
→ `verify:` Regression tests fail before fix, pass after.
→ `verify:` Every module has coverage map with identified gaps.
→ `verify:` Coverage gaps documented with risk assessment.
→ `verify:` "What Could Break?" analysis completed.

## Protocol Shells

All test operations follow protocol shell format:

/protocol {
  intent="Run and verify test suite for changed code",
  input={ scope="<changed-files>", suite="<test-target>" },
  process=[ /decompose{cases}, /verify{pass}, /synthesize{report} ],
  output={ result="<pass-fail-details>", artifacts="<reports>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Map changed files to affected test cases |
| /verify | Check test output against expected pass criteria |
| /synthesize | Combine results into regression report |

## When NOT to Use

- No code to test (pure design/planning/docs)
- Implementation incomplete or in flux
- No test framework set up
- One-off exploratory prototypes where harness overhead exceeds value

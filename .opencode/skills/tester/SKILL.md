---
id: tester
name: tester
description: 'After builder completes implementation. When user reports bugs (write regression test first). Before shipping (final test gate). For test coverage audits.'
phase: "TEST"
use_when: "After builder completes implementation. When user reports bugs (write regression test first). Before shipping (final test gate). For test coverage audits."
version: 1.0
---

## Use When

After builder completes implementation. User reports bugs (regression test first). Before shipping (final test gate). Coverage audits.

## Core Concept

Systematic testing across 5 type hierarchies — unit, integration, edge case, regression, type — with QA patterns and coverage gap analysis for comprehensive coverage.

## Precise Vocabulary

- **Unit Tests**: Function/component level, isolated with mocked dependencies.
- **Integration Tests**: Cross-module at integration points (API routes, DB calls, service layers).
- **Edge Cases**: Boundaries — empty states, max values, error paths, concurrency, type coercion.
- **Regression Tests**: Prove bugs stay fixed — fail before fix, pass after.
- **Type Tests**: Verify TS types via `expectTypeOf` or similar — type errors and inference.
- **Coverage Gap**: Areas lacking coverage, tracked by module with risk level.
- **QA Patterns**: Coverage maps and "What Could Break?" analysis.

## Context Requirements

- Project test framework and conventions
- Modules/components being tested
- Bug reproduction steps (for regression)
- Understanding of code assumptions

## Workflow

### 1. Systematic Test Coverage Map

Before writing tests, map needs:

| Module | Unit | Integration | Edge Cases |
|--------|------|-------------|------------|
| auth   | ✓    | ✓          | token expiry, invalid tokens |
| api    | ✓    | ✗          | rate limiting, pagination |

### 2. Unit Tests

Function/component level:
- Test each public function or component in isolation
- Mock dependencies (use existing patterns)
- Cover: happy path, error cases, boundary values
- Follow project conventions

### 3. Integration Tests

Cross-module:
- Test modules work together correctly
- Focus on integration points: API routes, DB calls, service layers
- Use real or in-memory implementations where practical

### 4. Edge Case Discovery

Boundary conditions:
- Empty states (null, undefined, empty arrays/strings)
- Max values (large inputs, pagination limits)
- Error paths (network/auth/validation failures)
- Concurrency (race conditions, parallel requests)
- Type coercion (unexpected/mixed types)

### 5. Regression Tests

Prove bugs stay fixed:
- Before fixing, write test that reproduces bug
- Must fail before fix, pass after
- Keep as simple as possible

### 6. Type Tests

Complex generic code:
- `expectTypeOf` or similar for TS types
- Type errors appear for invalid usage
- Type inference correct for valid usage

### 7. "What Could Break?" Analysis

For each change:
- What assumptions does code make?
- What happens when wrong?
- What could change in dependent modules?
- What production scenarios differ from tests?

### 8. Coverage Gap Reporting

After testing:
- Total tests written
- Coverage by module
- Gaps + risk level
- Recommendations for future improvements

## Tool Requirements

- Project's existing test framework
- Type testing utilities (expectTypeOf or equivalent)

## Output

When tests pass:

```
PASS  tests/auth.test.ts (12 tests)
PASS  tests/api.test.ts (8 tests)
Test Suites: 2 passed, 2 total
```

## Quality Criteria

- All tests pass (unit, integration, edge case, regression, type)
- Regression tests fail before fix, pass after
- Every module has coverage mapped with gaps identified
- Gaps documented with risk assessment

## When NOT to Use

- No code to test (pure design/planning/docs)
- Implementation incomplete or in flux
- No test framework set up
- One-off exploratory prototypes where harness overhead exceeds value

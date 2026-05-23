---
id: ag-tester
phase: "TEST"
use_when: "After ag-builder completes implementation. When user reports bugs (write regression test first). Before shipping (final test gate). For test coverage audits."
version: 1.0
---

## Use When

After ag-builder completes implementation. When user reports bugs (write regression test first). Before shipping (final test gate). For test coverage audits.

## Core Concept

Systematic testing discipline across five test type hierarchies — unit, integration, edge case, regression, and type tests — with QA patterns and coverage gap analysis to ensure comprehensive coverage.

## Precise Vocabulary

- **Unit Tests**: Behavior at function/component level, tested in isolation with mocked dependencies.
- **Integration Tests**: Cross-module interactions at integration points like API routes, database calls, and service layers.
- **Edge Cases**: Boundary conditions including empty states, maximum values, error paths, concurrency, and type coercion.
- **Regression Tests**: Tests that prove bugs stay fixed — written before the fix, they must fail before the fix and pass after.
- **Type Tests**: Verification of TypeScript types using `expectTypeOf` or similar, covering type errors and inference.
- **Coverage Gap**: Areas lacking test coverage, tracked by module with risk level assessment.
- **QA Patterns**: Systematic approaches including coverage maps and "What Could Break?" analysis.

## Context Requirements

- Project's existing test framework and conventions
- The modules or components being tested
- Bug reproduction steps (for regression tests)
- Understanding of what assumptions the code makes

## Workflow

### 1. Systematic Test Coverage Map

Before writing tests, map what needs coverage:

| Module | Unit | Integration | Edge Cases |
|--------|------|-------------|------------|
| auth   | ✓    | ✓          | token expiry, invalid tokens |
| api    | ✓    | ✗          | rate limiting, pagination |

### 2. Unit Tests

Behavior at function/component level:
- Test each public function or component in isolation
- Mock dependencies (use existing test patterns)
- Cover: happy path, error cases, boundary values
- Follow project's existing test framework and conventions

### 3. Integration Tests

Cross-module interactions:
- Test that modules work together correctly
- Focus on integration points: API routes, database calls, service layers
- Use real or in-memory implementations where practical

### 4. Edge Case Discovery

Systematically find boundary conditions:
- Empty states (null, undefined, empty arrays, empty strings)
- Maximum values (large inputs, pagination limits)
- Error paths (network failures, auth failures, validation errors)
- Concurrency (race conditions, parallel requests)
- Type coercion (unexpected types, mixed types)

### 5. Regression Tests

Tests that prove bugs stay fixed:
- Before fixing a bug, write a test that reproduces it
- The test must fail before the fix and pass after
- Keep regression tests as simple as possible

### 6. Type Tests

For complex generic code:
- Use `expectTypeOf` or similar to verify TypeScript types
- Test that type errors appear for invalid usage
- Test that type inference works correctly for valid usage

### 7. "What Could Break?" Analysis

For each change, ask:
- What assumptions does this code make?
- What happens when those assumptions are wrong?
- What could change in dependent modules?
- What production scenarios might differ from tests?

### 8. Coverage Gap Reporting

After testing, report:
- Total tests written
- Coverage by module
- Gaps found and their risk level
- Recommendations for future test improvements

## Tool Requirements

- Project's existing test framework
- Type testing utilities (expectTypeOf or equivalent) for type tests

## Output

When tests pass, capture the actual output:

```
PASS  tests/auth.test.ts (12 tests)
PASS  tests/api.test.ts (8 tests)
Test Suites: 2 passed, 2 total
```

## Quality Criteria

- All tests pass (unit, integration, edge case, regression, type)
- Regression tests fail before the fix and pass after
- Every module has coverage mapped with identified gaps
- Coverage gaps documented with risk assessment

## When NOT to Use

- When there is no code to test (pure design, planning, or documentation tasks)
- When the implementation is not yet complete or still in flux
- When the project has no test framework set up
- For one-off exploratory prototypes where test harness overhead exceeds value

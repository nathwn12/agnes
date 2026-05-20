---
name: ag-tester
description: Comprehensive testing — unit, integration, edge case, regression, and type tests with coverage gap analysis
---

## Phase: TEST

Use when: after ag-builder completes implementation, when user reports bugs (write regression test first), before shipping (final test gate), for test coverage audits.

## Test Type Hierarchy

### 1. Unit Tests

Behavior at function/component level:
- Test each public function or component in isolation
- Mock dependencies (use existing test patterns)
- Cover: happy path, error cases, boundary values
- Follow project's existing test framework and conventions

### 2. Integration Tests

Cross-module interactions:
- Test that modules work together correctly
- Focus on integration points: API routes, database calls, service layers
- Use real or in-memory implementations where practical

### 3. Edge Case Discovery

Systematically find boundary conditions:
- Empty states (null, undefined, empty arrays, empty strings)
- Maximum values (large inputs, pagination limits)
- Error paths (network failures, auth failures, validation errors)
- Concurrency (race conditions, parallel requests)
- Type coercion (unexpected types, mixed types)

### 4. Regression Tests

Tests that prove bugs stay fixed:
- Before fixing a bug, write a test that reproduces it
- The test must fail before the fix and pass after
- Keep regression tests as simple as possible

### 5. Type Tests

For complex generic code:
- Use `expectTypeOf` or similar to verify TypeScript types
- Test that type errors appear for invalid usage
- Test that type inference works correctly for valid usage

## QA Patterns

### Systematic Test Coverage Map

Before writing tests, map what needs coverage:
```markdown
| Module | Unit | Integration | Edge Cases |
|--------|------|-------------|------------|
| auth   | ✓    | ✓          | token expiry, invalid tokens |
| api    | ✓    | ✗          | rate limiting, pagination |
```

### "What Could Break?" Analysis

For each change, ask:
- What assumptions does this code make?
- What happens when those assumptions are wrong?
- What could change in dependent modules?
- What production scenarios might differ from tests?

### Coverage Gap Reporting

After testing, report:
- Total tests written
- Coverage by module
- Gaps found and their risk level
- Recommendations for future test improvements

## Evidence

When tests pass, capture the actual output:
```
PASS  tests/auth.test.ts (12 tests)
PASS  tests/api.test.ts (8 tests)
Test Suites: 2 passed, 2 total
```

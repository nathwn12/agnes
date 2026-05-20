---
name: ag-tdd
description: Red-green-refactor TDD through vertical slices — write failing test first, minimal code to pass, refactor only when green
---

# ag-tdd — Test-Driven Development

**Phase:** TEST / BUILD

**Use when:** Building new features from scratch, fixing bugs (write regression test first), or any time you need confidence that code does exactly what it should.

---

## Core Concept

Write the test first. Watch it fail. Write minimal code to pass. If you didn't watch the test fail, you don't know if it tests the right thing. Vertical slices only — each RED→GREEN cycle delivers a complete path through all layers.

---

## Iron Law

**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

Code written before the test must be **DELETED**. No exceptions. Don't keep it as reference, don't "adapt" it, don't look at it. Delete means delete.

---

## The Cycle

### 1. RED — Write ONE failing test
- One behavior per test. Clear name describing the expected behavior.
- Real code (no mocks unless unavoidable).
- Test through **public interfaces**, not implementation details.

### 2. Verify RED — Watch it fail
- Mandatory step. Run the test and confirm it fails.
- Check *why* it failed: compilation error (test wiring is wrong) vs assertion failure (behavior doesn't exist yet — correct RED).

### 3. GREEN — Write minimal code to pass
- Only enough code for **THIS** test.
- No YAGNI. No over-engineering. Resist the urge to build for "what's next."

### 4. Verify GREEN — Watch it pass
- Mandatory step. Run **all** tests. Output must be pristine.
- If any test is red, stop. Fix or revert.

### 5. REFACTOR — Only when ALL tests are green
- Remove duplication. Improve names. Deepen modules.
- Run tests after **EVERY** refactor step.
- **NEVER** refactor while RED. If you see red while refactoring, `git stash` or revert.

### 6. Repeat
- Pick the next behavior. Start at step 1.

---

## Vertical Slicing (NOT Horizontal)

| ❌ Wrong | ✅ Correct |
|----------|------------|
| Write ALL tests first | RED→GREEN, one slice at a time |
| Then write ALL implementation | Each slice = narrow but COMPLETE path |
| Tests test *imagined* behavior | A completed slice is demoable/verifiable |

Each vertical slice delivers a complete path through **every** layer: schema → API → UI → tests. No layer-skipping.

---

## Mocking Rules

| Mock at system boundaries | Do NOT mock |
|---------------------------|-------------|
| External APIs | Your own modules, classes, or internal collaborators |
| Databases (sometimes) | — |
| Time / randomness | — |
| Filesystem | — |

**Prefer SDK-style interfaces** over generic fetchers — each function independently mockable.

If mocking is complex, your architecture needs deepening — extract an interface at the boundary.

---

## Bad Test Red Flags

- Mocking internal collaborators
- Testing private methods
- Asserting on call counts or call order
- Verifying through external means (querying DB directly instead of using interface)
- Tests that break on internal refactor

---

## Bug Fix Integration

1. Bug found → write failing test reproducing it **FIRST**
2. Then fix the code
3. Test passes → bug is fixed and will never regress

No fix lands without a test proving the bug existed and is now gone.

---

## Workflow Summary

```
RED   ─→ Verify RED    ─→ GREEN  ─→ Verify GREEN  ─→ REFACTOR  ─→ Repeat
write      watch it        minimal    watch all        improve
test       fail            code       pass             names/modules
```

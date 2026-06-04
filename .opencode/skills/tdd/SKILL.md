---
name: tdd
id: tdd
phase: 'TEST / BUILD'
description: 'Building new features from scratch, fixing bugs (write regression test first), or any time you need confidence code does exactly what it should.'
---
## RULES
- No production code without failing test first. Code written before test MUST be deleted
- One behavior per test. Clear name describing expected behavior
- Test through public interfaces only, not implementation details
- No internal mocking — mock at system boundaries (external APIs, DB, time, filesystem)
- No call-count or call-order assertions
- YAGNI: only code for current test. No over-engineering
- Vertical slices only: each RED→GREEN delivers complete end-to-end path
- NEVER refactor while RED. See red → stash or revert
- Run ALL tests after every GREEN and every REFACTOR
- Bug fix: failing test reproducing bug FIRST

## FLOW
RED → Verify RED → GREEN → Verify GREEN → REFACTOR → Repeat
1. Write ONE failing test (RED)
2. Verify it fails (mandatory)
3. Write minimal code to pass (GREEN)
4. Verify ALL tests pass (mandatory)
5. Refactor only when ALL green
6. Repeat for next behavior

## TRIGGERS
- Building new features from scratch, fixing bugs
- Any time you need confidence code does what it should

## NEXT
- verifier — verify implementation after TDD cycle

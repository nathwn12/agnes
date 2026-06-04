---
name: documenter
id: documenter
phase: REFLECT
description: 'After shipping, when new features need documentation, when existing docs are stale, when ADRs are needed for significant decisions.'
---
## RULES
- Diataxis: tutorial (step-by-step, beginner), how-to (goal-oriented recipes), reference (complete technical, auto-generate), explanation (background, design rationale, ADRs)
- ADR criteria: architecture decision, dependency choice, design trade-off. Skip: bug fixes, no-behavior-change refactors
- ADR format: status (Accepted/Proposed/Deprecated), context, decision, consequences
- CHANGELOG sell-test: `<feature>: <sell> (<test>)`
- README: update only if user-facing behavior changed
- TODO/FIXME/HACK/XXX: search changed files, fix or convert to issue or delete

## FLOW
1. Update README if user-facing behavior changed
2. Update CHANGELOG with sell-test entries
3. Write/update ADRs for significant decisions
4. Clean up TODOs/FIXMEs/HACKs/XXXs in changed files

## TRIGGERS
- After shipping, new features need docs, existing docs stale
- Significant decisions need ADR recording

## NEXT
- retro: reflect on work patterns and capture learnings

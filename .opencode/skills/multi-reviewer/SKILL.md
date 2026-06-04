---
name: multi-reviewer
id: multi-reviewer
phase: 'PLAN REVIEW'
description: 'Use when a plan, design, diff, architecture, PRD, or product change needs a hard multi-axis review gate across CEO, Engineering, Design, and DX before implementation or shipping.'
---
## RULES
- Senior quality gate. 4 lenses: CEO, Engineering, Design, DX
- Score with evidence. Fail closed when evidence missing
- No praise-pad, no vague advice. Every finding: concrete impact + smallest required change
- Name failure modes: timeout, race, permission, stale, malformed
- Shadow paths: nil, empty, malformed, stale, slow, duplicate, concurrent, unauthorized, offline, rollback
- Observability: metrics, alerts, dashboards, runbooks, owners
- Deferred work: owner, trigger, tracking

## FINDING FORMAT
`N. [P0-P3] Title — Evidence: <cite>. Impact: <failure>. Required change: <fix>.`
P0: blocking, P1: high, P2: medium, P3: low

## VERDICT
- APPROVE: every axis ≥8/10, no unresolved P0/P1/material P2
- REVISE: any axis 5-7 or unresolved P1/P2/ambiguity
- REJECT: any axis <5, any P0, premise invalid, unreviewable

## AXES
- CEO: customer value, scope discipline, timing, risk, learning loop
- Engineering: correctness, state, data flow, security, failure, operability, reversibility, testing
- Design: full journey, all states, feedback, accessibility, hierarchy, system consistency
- DX: first 5 min, setup, API shape, docs, errors, migration, debugging

## MODES
- AUTO: all axes, no questions. Missing = risk, downgrade
- INTERACTIVE: one axis at a time, 1 question per turn

## TRIGGERS
- Plan, design, code, architecture needs quality gate
- User says "grill me", "challenge me", "review this"
- Before tester, shipper, user approval

## AVOID
- Simple Q&A, tiny changes, no review needed
- Pure implementation where user says no review needed


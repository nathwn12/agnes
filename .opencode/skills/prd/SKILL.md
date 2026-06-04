---
name: prd
id: prd
phase: PLAN
description: 'A feature request has been discussed enough to write requirements, before detailed implementation planning begins.'
---
## RULES
- Synthesize known context into structured PRD. Do NOT interview user for more
- Insufficient context → PRD reflects open questions
- PRD captures WHAT and WHY, not HOW
- Look for deep module extraction opportunities (simple interface hiding complex internals)
- Prefer deep modules over shallow (stable interface, easy to test, decoupled)

## FLOW
1. Explore repo: domain glossary, ADRs, patterns, codebase state. Check existing PRDs
2. Sketch major modules. Find deep module opportunities. Document each
3. 2-3 approaches if design unsettled. User approval before full PRD
4. User check: module sketch match expectations? Which need tests?
5. Write PRD to `.agnes/prd/YYYY-MM-DD-<feature>-prd.md`
6. Self-review: placeholders, contradictions, missing sections
7. Publish: create issue with `ready-for-agent` label if tracker in use

## PRD TEMPLATE
- Problem Statement, Solution, User Stories (priority)
- Implementation Decisions (constraints/tech choices only)
- Testing Decisions, Out of Scope, Open Questions, Further Notes

## TRIGGERS
- Feature request discussed enough to write requirements
- Before detailed implementation planning begins

## QUALITY
- No interviewing user, synthesize from context only
- No impl details except decision-encoding snippets
- All template sections populated or marked N/A

## AVOID
- Feature insufficiently discussed, context too thin
- User needs interviewing (use clarify)
- Task is implementation planning (use planner)

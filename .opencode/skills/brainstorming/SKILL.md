---
name: brainstorming
id: brainstorming
phase: THINK
description: 'Use before any creative work — exploring features, components, behavior. Explores design space before committing to implementation.'
---
## RULES
- Hard gate: no implementation until user approves written design
- One forcing question at a time. Push until concrete
- Propose 2-3 approaches: summary, effort, risk, pros, cons
- YAGNI ruthlessly. Wedge first: smallest valuable version
- Design for isolation: one purpose, defined interfaces, testable
- Forcing Qs: strongest evidence problem is real? workaround cost? who needs it most? narrowest wedge shipping this week? what surprised you watching users? value in 3 years?

## FLOW
1. Explore context: project files, docs, recent commits, prior art
2. Run forcing questions one at a time
3. Challenge premises: right problem? do nothing? existing solutions?
4. Propose 2-3 approaches with trade-offs. Recommend one
5. Present design: architecture, components, data flow, interfaces, errors, testing
6. Write design doc to `.agnes/specs/YYYY-MM-DD-<topic>-design.md`
7. Self-review: no TBD/TODO, internal consistency, scope focused
8. User approves → handoff to planner

## TRIGGERS
- Ambiguous creative direction, no clear implementation path
- Design space exploration before non-mechanical feature work

## NEXT
- planner: route approved design into implementation plan

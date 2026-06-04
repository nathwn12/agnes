---
name: clarify
id: clarify
phase: THINK
description: 'Vague requests, incomplete bug reports, cross-domain terminology conflicts. Before planning to ensure shared understanding.'
---
## RULES
- Hard gate: no implementation until user-approved written spec
- One question at a time. Never multiple in one message
- Format: state understanding → propose interpretation → ask single question
- Glossary-first: term conflicts with CONTEXT.md/ADRs → call out immediately
- Sharpen fuzzy language: propose precise canonical terms for vague words
- Use concrete edge-case scenarios to force precision
- Socratic method: questions lead user to discover answer. Assume good intent
- Inline CONTEXT.md updates during conversation
- ADRs only when: hard to reverse, surprising without context, real trade-off

## FLOW
1. Explore: project files, CONTEXT.md, ADRs, recent commits, issue tracker
2. Ask one question at a time. Sharpen terminology. Propose concrete scenarios
3. Propose 2-3 approaches with pros/cons/effort. Code sketches for critical decisions
4. Build shared understanding until: can describe back, user confirms, no ambiguities
5. Self-review: no TODO/FIXME, all files exist, no scope creep
6. Handoff: planning → planner, debugging → debugger

## TRIGGERS
- Vague requests, incomplete bug reports, terminology conflicts
- Before planning to ensure shared understanding

## NEXT
- planner: route clarified work into implementation plan
- debugger: route when user reports bug

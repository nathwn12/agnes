---
name: brainstorming
description: Refine ideas into validated design spec before any code.
---

# Brainstorming → Design

HARD GATE: no code until user approves design.

1. Explore project context (existing files, docs, changes).
2. Ask clarifying Qs one at a time. Prefer multiple-choice.
3. Propose 2-3 approaches with tradeoffs + recommendation.
4. Present design in sections: architecture, components, data flow, error handling, testing.
5. Design for isolation: one purpose per unit, clear interfaces, independent testability.
6. User must approve full design before proceeding.
7. Save to `docs/design/YYYY-MM-DD-<topic>.md`. Commit.
8. Next: `writing-plans` skill.

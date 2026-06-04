---
name: retro
id: retro
phase: REFLECT
description: 'End of sprint, feature shipped, or recurring issues noticed — reflect on work patterns and capture learnings.'
---
## RULES
- Transform implicit experience into explicit knowledge across sessions
- Learnings stored in `.agnes/learnings/YYYY-MM-DD-retro.md`
- Search existing learnings before repeating mistakes
- Prune stale learnings >60 days old
- Export high-value learnings to AGENTS.md as bullets
- Cover: velocity, patterns, bottlenecks, time distribution
- At least one actionable improvement per retro
- Learnings must be concrete, project-specific, actionable

## FLOW
1. Analyze commit history: `git log --oneline --since="7 days ago" --author="AGNES"`
2. What went well? What could be improved?
3. What should AGNES remember? — domain knowledge, gotchas, conventions
4. Save learnings to `.agnes/learnings/YYYY-MM-DD-retro.md`
5. Manage: search before repeat, prune stale, export to AGENTS.md

## TRIGGERS
- End of week or sprint, significant feature shipped
- AGNES notices recurring pattern: "Third time we've had this issue"
- User explicitly requests retro

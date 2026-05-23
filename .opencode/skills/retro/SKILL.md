---
id: retro
phase: "REFLECT"
use_when: "End of sprint, feature shipped, or recurring issues noticed — reflect on work patterns and capture learnings."
version: 1.0
---
## Use When

Run when:
- It's the end of the week or sprint
- A significant feature shipped
- AGNES notices a pattern: "This is the third time we've had this issue"
- The user explicitly requests it

## Core Concept

Systematic reflection on engineering work to capture learnings, identify improvements, and build cross-session memory. Transforms implicit experience into explicit knowledge that persists across AGNES sessions.

## Precise Vocabulary

- **Retrospective**: Structured reflection session analyzing completed work for patterns and improvements
- **Learning**: Captured insight from past work, stored for future reference
- **Velocity**: Rate of task or commit completion over a time period
- **Cross-session memory**: Persistent knowledge that survives across AGNES sessions, housed in `.agnes/learnings/`

## Context Requirements

- Git repository with recent commit history (past 7 days minimum)
- `.agnes/learnings/` directory exists for saving outputs
- `AGENTS.md` for cross-session persistence export

## Workflow

### 1. Analyze Commit History

Review what happened:
```bash
git log --oneline --since="7 days ago" --author="AGNES"
```
Analyze:
- **Velocity**: How many tasks completed? How many commits?
- **Patterns**: What types of work? (features, fixes, refactors, docs)
- **Bottlenecks**: Where did work stall? (reviews, tests, unclear requirements)
- **Time distribution**: Breakdown by phase (planning, building, testing, reviewing)

### 2. What Went Well?

Wins, good patterns, effective approaches:
- Which skills were most effective?
- What went smoothly?
- What should we keep doing?

### 3. What Could Be Improved?

Friction points, wasted time, repeated mistakes:
- What slowed us down?
- Where were misunderstandings?
- What should we stop doing or start doing?

### 4. What Should AGNES Remember?

Domain knowledge, project-specific gotchas:
- Which approaches work well for this codebase?
- What pitfalls should be avoided?
- What conventions or patterns emerged?

### 5. Save Learnings

Output retro document to `.agnes/learnings/YYYY-MM-DD-retro.md`.

### 6. Manage Learnings

- **Search existing learnings** before repeating a mistake: `grep -r "<topic>" .agnes/learnings/`
- **Prune stale learnings**: read learnings older than 60 days; if superseded mark deprecated; if irrelevant archive or delete
- **Export to AGENTS.md**: project-specific high-value learnings as bullet points; remove outdated before adding new

## Tool Requirements

| Tool | Usage |
|------|-------|
| git | Commit history analysis |
| grep / bash | Searching existing learnings |

## Output

Retro document at `.agnes/learnings/YYYY-MM-DD-retro.md` in the following format:

```markdown
# Retro: YYYY-MM-DD

## What Went Well
- [Item]

## What Could Be Improved
- [Item]

## Learnings
- [Item]
```

## Quality Criteria

- All four analysis dimensions covered (velocity, patterns, bottlenecks, time)
- At least one actionable improvement identified
- Learnings are concrete, project-specific, and actionable (not vague observations)
- Stale learnings pruned before new ones are added
- Output saved to correct path before session ends

## When NOT to Use

- During active debugging or incident response (use debugger or griller instead)
- Mid-task when focus is required (schedule for a natural break)
- For trivial or single-commit work without meaningful patterns to extract
- When the user explicitly declines a retro

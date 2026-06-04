---
id: retro
name: retro
description: 'End of sprint, feature shipped, or recurring issues noticed — reflect on work patterns and capture learnings.'
phase: "REFLECT"
use_when: "End of sprint, feature shipped, or recurring issues noticed — reflect on work patterns and capture learnings."
version: 1.0
---
## Use When

Run when:
- End of week or sprint
- Significant feature shipped
- AGNES notices pattern: "Third time we've had this issue"
- User explicitly requests it

## Core Concept

Systematic reflection on engineering work — capture learnings, identify improvements, build cross-session memory. Transforms implicit experience into explicit knowledge persisting across AGNES sessions.

## Precise Vocabulary

- **Retrospective**: Structured reflection analyzing completed work for patterns and improvements
- **Learning**: Captured insight from past work, stored for future reference
- **Velocity**: Rate of task/commit completion over time
- **Cross-session memory**: Persistent knowledge across AGNES sessions, in `.agnes/learnings/`

## Context Requirements

- Git repo with recent commit history (past 7 days minimum)
- `.agnes/learnings/` directory exists
- `AGENTS.md` for cross-session persistence export

## Workflow

### 1. Analyze Commit History

```bash
git log --oneline --since="7 days ago" --author="AGNES"
```
Analyze:
- **Velocity**: Tasks completed? Commits?
- **Patterns**: Work types? (features, fixes, refactors, docs)
- **Bottlenecks**: Where work stalled? (reviews, tests, unclear reqs)
- **Time distribution**: Breakdown by phase (planning, building, testing, reviewing)

### 2. What Went Well?

Wins, good patterns, effective approaches:
- Which skills most effective?
- What went smoothly?
- What should we keep doing?

### 3. What Could Be Improved?

Friction, wasted time, repeated mistakes:
- What slowed us down?
- Where were misunderstandings?
- What should we stop or start doing?

### 4. What Should AGNES Remember?

Domain knowledge, project-specific gotchas:
- Which approaches work for this codebase?
- What pitfalls to avoid?
- What conventions or patterns emerged?

### 5. Save Learnings

Output to `.agnes/learnings/YYYY-MM-DD-retro.md`.

### 6. Manage Learnings

- **Search existing** before repeating mistake: `grep -r "<topic>" .agnes/learnings/`
- **Prune stale**: read >60 days old; if superseded mark deprecated; if irrelevant archive/delete
- **Export to AGENTS.md**: project-specific high-value learnings as bullets; remove outdated before adding new

## Tool Requirements

| Tool | Usage |
|------|-------|
| git | Commit history analysis |
| grep / bash | Searching existing learnings |

## Output

Retro document at `.agnes/learnings/YYYY-MM-DD-retro.md`:

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

- All 4 dimensions covered (velocity, patterns, bottlenecks, time)
- At least one actionable improvement
- Learnings concrete, project-specific, actionable (not vague)
- Stale learnings pruned before new ones added
- Output saved to correct path before session ends

## When NOT to Use

- Active debugging or incident response (use debugger/grill-me)
- Mid-task needing focus (schedule for natural break)
- Trivial or single-commit work with no patterns to extract
- User explicitly declines retro

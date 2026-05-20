---
name: ag-retro
description: Engineering retrospective and learnings management — analyzes work patterns, captures wins and improvements, manages cross-session memory
---

## Phase: REFLECT — RETRO

Use when: weekly (end of sprint/week), after shipping a significant feature, when AGNES notices a pattern repeating.

## Retro Process

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

Output: `docs/agnes/learnings/YYYY-MM-DD-retro.md`

```markdown
# Retro: YYYY-MM-DD

## What Went Well
- [Item]

## What Could Be Improved
- [Item]

## Learnings
- [Item]
```

## Learnings Management

### Search Existing Learnings

Before repeating a mistake, search existing learnings:
```bash
grep -r "<topic>" docs/agnes/learnings/
```

### Prune Stale Learnings

- Read learnings older than 60 days
- If superseded, mark as deprecated
- If no longer relevant, archive or delete

### Export to AGENTS.md

For cross-session persistence, export key learnings to AGENTS.md:
- Only include project-specific, high-value learnings
- Format as bullet points in the relevant section
- Remove outdated learnings before adding new ones

## Triggers

Run retro when:
- It's the end of the week or sprint
- A significant feature shipped
- AGNES notices a pattern: "This is the third time we've had this issue"
- The user explicitly requests it

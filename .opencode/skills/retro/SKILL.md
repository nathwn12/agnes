---
id: retro
name: retro
description: 'End of sprint, feature shipped, or recurring issues noticed — reflect on work patterns and capture learnings.'
phase: "REFLECT"
use_when: "End of sprint, feature shipped, or recurring issues noticed — reflect on work patterns and capture learnings."
version: 1.0
---

## Tradeoff

More retro = better patterns but slower throughput. Less retro = faster iteration but repeated mistakes. Run at natural breaks (sprint end, feature ship, or 3rd recurrence). Don't retro mid-incident.

## Use When

- End of week or sprint
- Significant feature shipped
- AGNES notices pattern: "3rd time this issue"
- User explicitly requests it

## Core Concept

Systematic reflection → capture learnings → improvements → cross-session memory. Transform implicit experience into explicit knowledge persisting across sessions in `.agnes/learnings/`.

## Vocabulary

- **Retrospective**: Structured reflection analyzing completed work for patterns and improvements
- **Learning**: Captured insight, stored for future reference
- **Velocity**: Rate of task/commit completion over period
- **Cross-session memory**: Persistent knowledge in `.agnes/learnings/`

## Context

- Git repo with commit history (past 7 days min)
- `.agnes/learnings/` exists for outputs
- `AGENTS.md` for cross-session persistence export

## Workflow

### 1. Analyze Commit History
```
git log --oneline --since="7 days ago" --author="AGNES"
```
→ verify: velocity (tasks/commits), patterns (features/fixes/refactors/docs), bottlenecks (reviews/tests/requirements), time distribution per phase

### 2. What Went Well?
Wins, good patterns, effective approaches.
→ verify: which skills most effective, what went smooth, what to keep

### 3. What Could Be Improved?
Friction, wasted time, repeated mistakes.
→ verify: slowdowns, misunderstandings, stop/start actions

### 4. What Should AGNES Remember?
Domain knowledge, project-specific gotchas.
→ verify: working approaches, pitfalls, emergent conventions

### 5. Save Learnings
Write to `.agnes/learnings/YYYY-MM-DD-retro.md`.
→ verify: file exists, format correct

### 6. Manage Learnings
- Search: `grep -r "<topic>" .agnes/learnings/`
- Prune stale: >60 days old → mark deprecated or archive
- Export to AGENTS.md: high-value items as bullet points, remove outdated before adding
→ verify: stale count before/after, export correct

### Phase Outputs

| Phase | Output |
|-------|--------|
| Analyze | Velocity/pattern/bottleneck summary |
| Went Well | Wins list |
| Improvements | Friction list |
| Remember | Learning items |
| Save | `.agnes/learnings/YYYY-MM-DD-retro.md` |
| Manage | Pruned + exported learnings |

## Flow Diagram

```
Commit History ──► Analyze ──► ID Wins ──► ID Improvements ──► Extract Learnings
                                      \         |               /
                                       ▼        ▼              ▼
                                  `.agnes/learnings/YYYY-MM-DD-retro.md`
                                                │
                                                ▼
                                          Prune Stale ──► Export to AGENTS.md
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| git log | Analyze | 7-day commit history | Velocity/pattern summary |
| grep / bash | Manage | Topic query | Matching learning files |
| Write | Save | Retro content | `.agnes/learnings/YYYY-MM-DD-retro.md` |

## Examples

| Trigger | Key Finding | Action |
|---------|-------------|--------|
| 3rd type bug post-refactor | Missing test for edge case | Add to test checklist skill |
| Sprint velocity dropped 40% | Overloaded planner phase | Cap concurrent tasks at 3 |
| Repeated auth middleware fix | No integration test suite | Create auth-test skill |

## Output

`.agnes/learnings/YYYY-MM-DD-retro.md`:

```markdown
# Retro: YYYY-MM-DD

## What Went Well
- [item]

## What Could Be Improved
- [item]

## Learnings
- [item]
```

## Quality

→ verify: all 4 analysis dimensions covered (velocity, patterns, bottlenecks, time)
→ verify: at least 1 actionable improvement
→ verify: learnings concrete, project-specific, actionable (not vague)
→ verify: stale learnings pruned before new added
→ verify: output saved to correct path before session ends

## Protocol Shell

```
/protocol {
  intent="Reflect on work patterns and capture learnings",
  input={ period="<sprint-or-feature>", events="<what-happened>" },
  process=[ /abstract{patterns}, /reflect{improvements}, /synthesize{actions} ],
  output={ result="<retro-notes>", actions="<follow-up-items>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /abstract | Extract patterns from completed work |
| /reflect | Self-critique process for improvement areas |
| /synthesize | Combine observations into actionable follow-ups |

## When NOT to Use

- Active debugging or incident response (use debugger or griller)
- Mid-task requiring focus (schedule for natural break)
- Trivial/single-commit work with no meaningful patterns
- User explicitly declines

---
id: instinct
name: instinct
description: 'Cross-session context retention, pattern learning, and instinct lifecycle management. Use when agents need to remember what works, share learned patterns, promote project-level knowledge to global, or autonomously create skills from repeated behavior.'
phase: "META"
use_when: "Cross-session context retention, pattern learning, instinct lifecycle (status/import/export/evolve/promote), autonomous skill creation from observed behavior, confidence-based reinforcement with decay."
version: 1.0.0
---

# instinct

**Tradeoff:** Cross-session pattern memory requires storage overhead and confidence calibration to avoid stale/noisy instincts.

## Core Concept

**Instinct** = learned pattern + confidence score. Observed, not written — agent notices recurring behavior, records pattern, reinforces or decays confidence. Natural selection: useful strengthens, unused fades.

Three influences: ECC instinct commands (structured lifecycle), Hermes autonomous creation (self-improving loop), GStack taste memory (confidence decay).

## Precise Vocabulary

| Term | Meaning |
|------|---------|
| Instinct | Learned pattern with confidence + trigger-action |
| Confidence | Float 0.0–1.0 representing reliability |
| Decay | Confidence reduction over time without reinforcement |
| Reinforcement | Confidence increase on successful application |
| Promote | Elevate project-level instinct to global scope |
| Evolve | Analyze instincts to suggest new skills/commands/agents |
| Trigger | Context that activates an instinct |
| Action | Prescribed response when trigger matches |
| Application Count | Times instinct matched and acted upon |
| Source | How instinct was created |

## Context Requirements

- Read/write `.agnes/instincts/` (project) and `~/.config/opencode/instincts/` (global)
- Session history for pattern observation
- `.agnes/evolved/` for evolved output

## Workflow

```
Observation → Creation → Application → Reinforcement/Punishment → Decay/Promotion → Archive
```

1. **OBSERVE** — detect recurring patterns (3+ across independent files)
2. **CREATE** — record as instinct with initial confidence 0.5–0.7
3. **APPLY** — trigger when similar context detected, follow action
4. **REINFORCE** — +0.05 to +0.15 on success (cap 1.0)
5. **PUNISH** — −0.1 to −0.3 on failure
6. **DECAY** — unused lose 5%/week
7. **PROMOTE** — ≥0.85 → project to global
8. **ARCHIVE** — below 0.1 archived recoverably

### @explorer Discipline

```
[glob first] → verify: file structure patterns found
[grep second] → verify: repeated idioms/imports/naming confirmed
[read last] → verify: patterns validated in specific files
[record] → verify: instinct created if 3+ occurrences across independent files
```

### After Every 5 Completed Tasks

1. Review recent applications → success rate ≥60%
2. Lightweight evolve → candidate skills flagged
3. Archive below threshold → count matches expected
4. Flag promotions → ≥0.85 + ≥10 apps

**Output:** Active instinct registry with confidence scores, archived instincts, promotion/evolution candidates.

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| glob | OBSERVE | File pattern | Matching paths |
| grep | OBSERVE | Regex pattern | Matched lines + context |
| read | OBSERVE, VERIFY | File path | File contents |
| write | CREATE, EXPORT | Path + content | Written file |
| instinct-status | REVIEW | Scope filter | Instincts by domain |
| instinct-import | SETUP | Source path/URL | Validated deduplicated |
| instinct-export | SHARE | Filters | JSON with metadata |
| instinct-evolve | REFLECT | Instinct clusters | Skills/commands/agents |
| instinct-promote | SHIP | --confidence/--id/--all | Global store updated |

## Output

Observed patterns with confidence, archived recoverable, promoted to global, evolved skill candidates from clusters, import/export JSON.

## Quality Criteria

- Instincts observed, not invented → verify: source + evidence
- Confidence reflects actual success rate → verify: tracked per application
- Decay prevents staleness → verify: recalculated from timestamp
- Promotion requires ≥0.85 + ≥10 apps → verify: both met
- Exports valid JSON, imports validated + deduplicated + confidence-adjusted (×0.8)
- Autonomous creation: 3+ observations only → verify: count confirmed
- Archived recoverable (not deleted)
- Applications update success count + timestamp → verify: both written

## Confidence & Decay Model

Default parameters (GStack taste memory model):

| Parameter | Default | Description |
|-----------|---------|-------------|
| Initial confidence | 0.6 | Starting confidence |
| Reinforcement increment | +0.08 | Increase on success |
| Punishment decrement | −0.15 | Decrease on failure |
| Decay rate | 0.05/week | Lost per week unused |
| Minimum threshold | 0.1 | Auto-archive below this |
| Promotion threshold | 0.85 | Min for promotion |

Confidence clamped to [0.0, 1.0]. Decay: `confidence -= decay_rate × weeks_unused`.

### Agent Self-Correction

On wrong outcome: decrease confidence, attach negative example, archive if below threshold (never delete — archived reviewed and restored).

## Autonomous Creation

Hermes-inspired. Pattern seen 3+ times in session:
1. Create instinct with trigger-action → verify: both defined
2. Set initial confidence 0.5–0.7 based on frequency/consistency
3. Assign domain category, record source="session-observation" with session ref
4. Register in local store

At ≥0.85 + 10+ successful applications → flag as **skill candidate**.

Each application: record outcome, adjust confidence, if success <60% after 5+ → flag for review.

## Integration with AGNES Workflow

| Phase | Instinct Role |
|-------|---------------|
| SETUP | Load relevant instincts |
| RESEARCH | Observe and record patterns |
| PLAN | Check known pitfalls and preferred approaches |
| BUILD | Reinforce on success |
| REVIEW | Flag violated instincts |
| VERIFY | Record application outcome |
| REFLECT | Evolve instincts into skills |

## Format Specifications

### Instinct Record

```json
{
  "id": "instinct-<hash>", "trigger": "Building a new AGNES skill",
  "action": "Read existing SKILL.md for frontmatter conventions",
  "confidence": 0.72, "category": "skill-writing",
  "applications": 4, "successes": 4,
  "source": "session-observation",
  "created": "2026-05-25T14:00:00Z", "lastApplied": "2026-05-25T14:30:00Z"
}
```

### Storage

- **Project**: `.agnes/instincts/`
- **Global**: `~/.config/opencode/instincts/`
- **Evolved**: `.agnes/evolved/`

## Skip When

No session history yet, one-off tasks, pattern already in existing skill, secrets/credentials.

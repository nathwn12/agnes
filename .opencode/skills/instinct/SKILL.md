---
id: instinct
name: instinct
description: 'Cross-session context retention, pattern learning, and instinct lifecycle management. Use when agents need to remember what works, share learned patterns, promote project-level knowledge to global, or autonomously create skills from repeated behavior.'
phase: "META"
use_when: "Cross-session context retention, pattern learning, instinct lifecycle (status/import/export/evolve/promote), autonomous skill creation from observed behavior, confidence-based reinforcement with decay."
version: 1.0.0
---

## Use When

Agent needs to remember what works across sessions. Learned patterns with confidence scores decaying without reinforcement. Promoting project-level instincts to global. Exporting/importing instincts. Autonomous creation of skills from repeated behavior.

## Core Concept

**Instinct** = learned pattern + confidence score. Bridge between ephemeral session context and persistent agent memory.

Unlike plans (task-specific) or skills (authored), instincts are **observed, not written**. Agent notices repeated behavior, records pattern, reinforces or decays confidence. Natural selection: useful instincts survive; unused fade.

Three influences fused:

1. **ECC instinct commands** — structured memory lifecycle (status/import/export/evolve/promote)
2. **Hermes autonomous creation** — self-improving loop, agent creates skills from experience
3. **GStack taste memory** — confidence decay without reinforcement

## Precise Vocabulary

| Term | Meaning |
|------|---------|
| Instinct | Learned pattern with confidence score and trigger-action structure |
| Confidence | Float 0.0–1.0 representing reliability |
| Decay | Confidence reduction over time without reinforcement |
| Reinforcement | Confidence increase on successful application |
| Promote | Elevate project-level instinct to global scope |
| Evolve | Analyze instincts to suggest new skills, commands, agents |
| Trigger | Context activating an instinct |
| Action | Prescribed response when trigger matches |
| Application Count | Times instinct matched and acted upon |
| Source | Creation method (session-observation, imported, authored) |

## Instinct Lifecycle

```
Observation → Creation → Application → Reinforcement / Punishment → Decay or Promotion → Archive
```

1. **Observation** — agent detects recurring pattern
2. **Creation** — pattern recorded as instinct, initial confidence 0.5–0.7
3. **Application** — instinct triggers on similar context; agent follows action
4. **Reinforcement** — success increases confidence (+0.05 to +0.15, cap 1.0)
5. **Punishment** — failure decreases confidence (−0.1 to −0.3)
6. **Decay** — unused instincts lose confidence (default 5%/week)
7. **Promotion** — high-confidence instincts promoted project → global
8. **Archive** — instincts below threshold (default 0.1) archived

### @explorer Discipline for Instinct Observation

1. **Glob first** — file structure patterns
2. **Grep second** — repeated idioms, import patterns, naming conventions
3. **Read last** — confirm patterns
4. **Record** — create instinct if pattern appears 3+ times across independent files

## Instinct Operations

### Status

Show instincts with confidence, grouped by domain:

```
Type: instinct-status
Context: current project scope
Output: instincts grouped by domain with confidence bars
Override: project instincts override global on ID conflict
```

### Import

Bring instincts from external sources:

```
Type: instinct-import
Sources: file path, URL, @teammate
Process: validate → deduplicate → adjust confidence (×0.8) → merge → report
Conflict: keep higher confidence, merge app counts, update timestamp
```

### Export

Share or backup instincts:

```
Type: instinct-export
Filters: --min-confidence N, --category NAME, --output PATH
Output: JSON with instincts + metadata (version, timestamp, author, total)
Default: all instincts
```

### Evolve

Analyze clusters for higher-order structure:

```
Type: instinct-evolve
Analysis: trigger + domain clustering from project + global instincts
Output: candidate skills, commands, agents
Generation: --generate writes to .agnes/evolved/
Promotion: identifies instincts ready for project → global
```

### Promote

Elevate project-level instincts to global:

```
Type: instinct-promote
Selection: --confidence N, --id INSTINCT_ID, or --all
Behavior: copy to global store, source="promoted", timestamp updated
Global: promoted instincts apply across all projects unless overridden
```

## Confidence & Decay Model

| Parameter | Default | Description |
|-----------|---------|-------------|
| Initial confidence | 0.6 | Starting confidence |
| Reinforcement increment | +0.08 | On successful application |
| Punishment decrement | −0.15 | On failed application |
| Decay rate | 0.05/week | Confidence lost per week without use |
| Minimum threshold | 0.1 | Auto-archive below this |
| Promotion threshold | 0.85 | Minimum for promotion eligibility |

Confidence clamped [0.0, 1.0]. Decay from last-application timestamp: `decay_rate × weeks_unused`.

### Agent Self-Correction

Wrong outcome:
1. Decrease confidence by punishment decrement
2. Optionally add negative example to context
3. Below threshold → archive
4. Never delete — archived instincts are recoverable

## Autonomous Creation

Pattern detected 3+ times in a session → autonomously:

1. **Create instinct** with trigger-action pattern
2. **Set initial confidence** from frequency + consistency
3. **Assign domain category** from pattern context
4. **Record source** as "session-observation" with session ref
5. **Register** in local store

At confidence ≥0.85 and 10+ successful applications → flag as **skill candidate** (deserves SKILL.md).

### Autonomous Refinement

Each application:
- Record success/failure
- Adjust confidence
- Success rate <60% after 5+ apps → flagged for review
- Optionally update trigger or action

## Integration with AGNES Workflow

| Phase | Instinct Role |
|-------|---------------|
| SETUP | Load relevant instincts for project context |
| RESEARCH | Observe and record patterns during exploration |
| PLAN | Check instincts for pitfalls and preferred approaches |
| BUILD | Reinforce instincts on successful implementation |
| REVIEW | Flag violated instincts as findings |
| VERIFY | Record application success/failure |
| REFLECT | Evolve instincts into skills during retro |

After every 5 completed tasks:
1. Review recent instinct applications
2. Run lightweight evolve analysis
3. Archive instincts below threshold
4. Flag promotion candidates

## Format Specifications

### Instinct Record

```json
{
  "id": "instinct-<hash>",
  "trigger": "Building a new AGNES skill",
  "action": "Read an existing skill's SKILL.md first for frontmatter conventions",
  "confidence": 0.72,
  "category": "skill-writing",
  "applications": 4,
  "successes": 4,
  "source": "session-observation",
  "created": "2026-05-25T14:00:00Z",
  "lastApplied": "2026-05-25T14:30:00Z"
}
```

### Storage

- **Project instincts**: `.agnes/instincts/`
- **Global instincts**: `~/.config/opencode/instincts/`
- **Evolved output**: `.agnes/evolved/` (with --generate)
- **Exports**: JSON at user-specified paths

## Quality Criteria

- Instincts observed, not invented — source + evidence
- Confidence reflects actual success rate
- Decay prevents stale patterns blocking better approaches
- Promotion requires evidence (high confidence + sufficient apps)
- Exports valid JSON with complete metadata
- Imports validated, deduplicated, confidence-adjusted
- Autonomous creation only on 3+ observations
- Archived instincts recoverable

## When NOT to Use

- No session history or repeated patterns yet
- One-off tasks with no expected repetition
- Pattern already covered by existing AGNES skill
- Secrets, credentials, or project-specific sensitive info

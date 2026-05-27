---
id: instinct
name: instinct
description: 'Cross-session context retention, pattern learning, and instinct lifecycle management. Use when agents need to remember what works, share learned patterns, promote project-level knowledge to global, or autonomously create skills from repeated behavior.'
phase: "META"
use_when: "Cross-session context retention, pattern learning, instinct lifecycle (status/import/export/evolve/promote), autonomous skill creation from observed behavior, confidence-based reinforcement with decay."
version: 1.0.0
---

## Use When

An agent needs to remember what works across sessions. Learned patterns with confidence scores that decay without reinforcement. Promoting project-level instincts to global scope. Exporting and importing instincts between projects or teammates. Autonomous creation of skills from observed, repeated behavior.

## Core Concept

An **instinct** is a learned pattern paired with a confidence score — the agent's accumulated knowledge about "what works here." Instincts form the bridge between ephemeral session context and persistent agent memory.

Unlike plans (which are task-specific) or skills (which are authored), instincts are **observed, not written**. The agent notices itself doing something repeatedly, records the pattern, and reinforces or decays the confidence over time. This creates a natural selection pressure: useful instincts survive and strengthen; unused instincts fade.

Three influences fused into one coherent model:

1. **ECC instinct commands** — structured memory lifecycle (status/import/export/evolve/promote) that provides the operational framework
2. **Hermes autonomous creation** — the self-improving loop where agents create skills autonomously from experience, refined during use
3. **GStack taste memory** — confidence decay over time without reinforcement, preventing stale patterns from persisting indefinitely

## Precise Vocabulary

| Term | Meaning |
|------|---------|
| Instinct | A learned pattern with a confidence score and trigger-action structure |
| Confidence | A float 0.0–1.0 representing how reliably this instinct has been correct |
| Decay | Confidence reduction over time when an instinct is not reinforced |
| Reinforcement | Increasing confidence when an instinct is successfully applied |
| Promote | Elevating a project-level instinct to global scope |
| Evolve | Analyzing instincts to suggest new skills, commands, or agents |
| Trigger | The situation or context that activates an instinct |
| Action | The prescribed response when the trigger matches |
| Application Count | How many times an instinct has been matched and acted upon |
| Source | How the instinct was created (session-observation, imported, authored) |

## Instinct Lifecycle

```
Observation → Creation → Application → Reinforcement / Punishment → Decay or Promotion → Archive
```

1. **Observation** — the agent detects a recurring pattern ("every time I build a React component, I reach for this file structure")
2. **Creation** — the pattern is recorded as an instinct with initial confidence (typically 0.5–0.7)
3. **Application** — the instinct triggers when similar context is detected; agent follows the recommended action
4. **Reinforcement** — successful application increases confidence (+0.05 to +0.15, capped at 1.0)
5. **Punishment** — failed application decreases confidence (−0.1 to −0.3)
6. **Decay** — unused instincts lose confidence over time (configurable rate, default 5% per week)
7. **Promotion** — high-confidence instincts promoted from project scope to global
8. **Archive** — instincts below minimum confidence threshold (default 0.1) are archived

### @explorer Discipline for Instinct Observation

When exploring a codebase for pattern detection:

1. **Glob first** — find file structure patterns
2. **Grep second** — search for repeated idioms, import patterns, naming conventions
3. **Read last** — confirm suspected patterns in specific files
4. **Record** — create instinct if a pattern appears 3+ times across independent files

## Instinct Operations

### Status

Show learned instincts with confidence scores, grouped by domain:

```
Type: instinct-status
Context: current project scope
Output: instincts grouped by domain with confidence bars
Override behavior: project instincts override global instincts when IDs conflict
```

### Import

Bring instincts from external sources (files, URLs, teammate exports):

```
Type: instinct-import
Sources: file path, URL, or @teammate reference
Process: validate → deduplicate → adjust confidence (×0.8 for imports) → merge → report
Conflict resolution: keep higher confidence version, merge application counts, update timestamp
```

### Export

Share instincts with others or back them up:

```
Type: instinct-export
Filters: --min-confidence N, --category NAME, --output PATH
Output: JSON with instincts array + metadata (version, exported timestamp, author, total)
Default: all instincts if no filters provided
```

### Evolve

Analyze instinct clusters for higher-order structure:

```
Type: instinct-evolve
Analysis: trigger + domain clustering from project + global instincts
Output: candidate skills, commands, or agents derived from instinct clusters
Generation: --generate flag writes evolved structures to .agnes/evolved/
Promotion candidates: identifies instincts ready for project → global promotion
```

### Promote

Elevate project-level instincts to global scope:

```
Type: instinct-promote
Selection: by --confidence N (minimum confidence threshold), --id INSTINCT_ID, or --all
Behavior: copied to global store, source updated to "promoted", timestamp updated
Global override: promoted instincts apply across all projects unless overridden
```

## Confidence & Decay Model

Default configuration (modeled after GStack taste memory):

| Parameter | Default | Description |
|-----------|---------|-------------|
| Initial confidence | 0.6 | Starting confidence for a new instinct |
| Reinforcement increment | +0.08 | Increase on successful application |
| Punishment decrement | −0.15 | Decrease on failed application |
| Decay rate | 0.05/week | Confidence lost per week without use |
| Minimum threshold | 0.1 | Below this, instinct is auto-archived |
| Promotion threshold | 0.85 | Minimum confidence for promotion eligibility |

Confidence is clamped to [0.0, 1.0] after every operation. Decay is calculated from last-application timestamp. If an instinct has not been applied within the decay window, confidence drops by `decay_rate × weeks_unused`.

### Agent Self-Correction

When an instinct leads to a wrong outcome, the agent should:
1. Decrease confidence by punishment decrement
2. Optionally add a negative example to the instinct's context
3. If confidence drops below threshold, archive the instinct
4. Never delete — archived instincts can be reviewed and restored

## Autonomous Creation

Inspired by Hermes Agent's closed learning loop. When the agent detects a pattern occurring 3+ times in a session, it should autonomously:

1. **Create an instinct** with the observed trigger-action pattern
2. **Set initial confidence** based on pattern frequency and consistency
3. **Assign a domain category** derived from the pattern's context
4. **Record source** as "session-observation" with session reference
5. **Register the instinct** in the local store

When an instinct reaches high confidence (≥0.85) and has been successfully applied 10+ times, the agent should flag it as a **skill candidate** — a pattern solid enough to deserve authored skill status with a SKILL.md file.

### Autonomous Refinement During Use

Each time an instinct is applied:
- The agent records success or failure
- Confidence adjusts accordingly
- If success rate falls below 60% after 5+ applications, the instinct is flagged for review
- The agent may update the trigger or action based on new observations

## Integration with AGNES Workflow

Instincts complement the existing plan → build → verify loop:

| Phase | Instinct Role |
|-------|---------------|
| SETUP | Load relevant instincts for project context |
| RESEARCH | Observe and record patterns during exploration |
| PLAN | Check instincts for known pitfalls and preferred approaches |
| BUILD | Reinforce instincts on successful implementation |
| REVIEW | Flag violated instincts as review findings |
| VERIFY | Record application success/failure |
| REFLECT | Evolve instincts into skills during retro |

After every 5 completed tasks, the agent should:
1. Review recent instinct applications
2. Run a lightweight evolve analysis
3. Archive any instincts below threshold
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

- **Project instincts**: `.agnes/instincts/` directory
- **Global instincts**: `~/.config/opencode/instincts/` directory
- **Evolved output**: `.agnes/evolved/` directory (when --generate is used)
- **Exports**: JSON files at user-specified paths

## Quality Criteria

- Instincts are observed, not invented — every instinct has a source and evidence
- Confidence reflects actual success rate, not aspiration
- Decay prevents stale patterns from blocking better approaches
- Promotion requires evidence (high confidence + sufficient applications)
- Exports are valid JSON with complete metadata
- Imports are validated, deduplicated, and confidence-adjusted
- Autonomous creation only fires on 3+ repeated observations
- Archived instincts remain recoverable

## When NOT to Use

- When the agent has no session history or repeated patterns yet
- For one-off tasks with no expectation of repetition
- When the pattern is already covered by an existing AGNES skill
- For secrets, credentials, or project-specific sensitive information

## Protocol Shells

All instinct operations follow the protocol shell format:

/protocol {
  intent="Capture and apply cross-session learning patterns",
  input={ pattern="<observed-behavior>", context="<project-state>" },
  process=[ /abstract{pattern}, /verify{applicability}, /synthesize{instinct} ],
  output={ result="<learned-pattern>", confidence="<score>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /abstract | Extract reusable patterns from repeated behavior |
| /verify | Check pattern applicability to current context |
| /synthesize | Combine observations into a ranked instinct list |

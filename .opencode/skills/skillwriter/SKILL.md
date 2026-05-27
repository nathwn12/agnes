---
id: skillwriter
name: skillwriter
description: 'Use when creating a brand-new AGNES skill, editing/improving an existing skill, closing a gap identified during retro, or when an agent demonstrably behaves wrongly without documented guidance.'
phase: "REFLECT / META"
use_when: "Creating a brand-new AGNES skill, editing/improving an existing skill, closing a gap identified during retro, or when an agent demonstrably behaves wrongly without documented guidance."
version: 1.1
---

# skillwriter

**Tradeoff:** Structure vs speed. Pressure-first (RED) prevents scope creep and loopholes but costs upfront write time. Skip scenarios on trivial typos only. On any behavior-altering change, write them. When uncertain, RED.

## Core Concept

> **NO SKILL WITHOUT A FAILING TEST FIRST**

Applies to new skills AND edits. Can't describe a scenario where agent behaves wrongly without the skill → don't know what to enforce. Writing the scenario IS the analysis.

## Precise Vocabulary

| Term | Definition |
|------|------------|
| **RED** | Phase: write pressure scenarios before skill code exists |
| **GREEN** | Phase: write minimal skill addressing only pressure scenarios |
| **REFACTOR** | Phase: close loopholes, bulletproof |
| **Pressure scenario** | Concrete test case for one specific failure mode |
| **Rationalization** | Excuse an agent might use to bypass rules |
| **Skill type** | Classification: discipline-enforcing, technique, pattern, reference |
| **Verb-first gerund** | Named after ACTION not THING (skillwriter not skill-creation) |

## Context Requirements

- `.opencode/skills/<name>/` directory for skill packages
- Existing skills to study naming/formatting conventions
- Real agent failures or test outputs to ground scenarios
- This skill produces candidate; shipper handles final landing

## Workflow

### RED — Write Pressure Scenarios

[RED] Create 3-5 concrete scenarios in `.opencode/skills/<name>/tests/pressure-scenarios.md`. → verify: each has prompt, observed bad behavior, why wrong, verification command

```
## Scenario N: <name>

**Prompt:** "What user says"
**Observed behavior:** What agent does WITHOUT skill
**Why it's wrong:** Specific harm or deficiency
**Verification:** Command + expected output
```

[RED] Use real prompts and bad outputs, no hypotheticals. → verify: each scenario is grounded in observation
[RED] Can't produce 3 real failures → stop, don't understand problem well enough. → verify: minimum 3 scenarios written

**Phase output:** `tests/pressure-scenarios.md` with 3-5 verified scenarios

### GREEN — Write Minimal Skill

[GREEN] Address ONLY the failures in pressure scenarios. → verify: no speculative rules beyond scenario coverage

- AGNES SKILL.md format: YAML frontmatter + markdown sections
- Include: core concept, workflow/phases, key rules, anti-patterns table
- Target: <200 words (frequent-load), <500 words (all others). → verify: word count under limit
- [GREEN] Run each pressure scenario against skill, verify compliance. → verify: all scenarios pass
- Document verification results

**Phase output:** `SKILL.md` (draft) with verified scenario compliance

### REFACTOR — Bulletproof

[REFACTOR] Close loopholes before shipping. → verify: every rationalization has explicit counter

1. Identify rationalizations → document in anti-patterns table
2. Add explicit counters per rationalization
3. Spirit vs letter — if literal compliance violates intent, add clarifying rules
4. [REFACTOR] Re-run all pressure scenarios. → verify: all pass after bulletproofing
5. Repeat until bulletproof

**Phase output:** Bulletproof `SKILL.md` with filled anti-patterns table

```
                    ┌─────────────────┐
                    │  Gap identified │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  RED: Write 3-5 │
                    │  pressure       │──── verify: specific, real, verifiable
                    │  scenarios      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  GREEN: Write   │
                    │  minimal skill  │──── verify: covers all scenarios, no extras
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  REFACTOR:      │
                    │  bulletproof    │──── verify: rationalizations countered,
                    └────────┬────────┘       all scenarios pass
                             │
                             ▼
                    ┌─────────────────┐
                    │  Ship candidate │──→ shipper handles final landing
                    └─────────────────┘
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| read | RED, GREEN, REFACTOR | Existing skills, scenarios | Convention knowledge, gap analysis |
| write | GREEN, REFACTOR | Skill content | SKILL.md, pressure-scenarios.md |
| edit | GREEN, REFACTOR | Existing SKILL.md | Updated SKILL.md |
| bash | RED, GREEN, REFACTOR | Verification commands | Pass/fail per scenario |
| glob | RED, GREEN | Directory patterns | File locations |
| grep | RED, GREEN | Pattern searches | Cross-skill references |

## Examples

| If | Then | Verify |
|----|------|--------|
| Agent ignores coding conventions | Write scenario with specific violation, cover in rules | Scenario passes → skill fixes behavior |
| Existing skill has known loophole | Add scenario for loophole, write minimal fix | All old + new scenarios pass |
| Retro identified agent behavior gap | 3 scenarios from real retro output, write skill | Retro scenario set passes |
| Typo fix only, no behavior change | Skip RED, edit directly | No scenarios needed |
| Agent rationalizes around rule | Add rationalization + counter in anti-patterns table | Rationalization countered explicitly |

## Output

```
.opencode/skills/<skill-name>/
├── SKILL.md
└── tests/
    └── pressure-scenarios.md
```

## Quality

### Skill Types

| Type | Flexibility | Example | Format |
|------|------------|---------|--------|
| **Discipline-enforcing** | Rigid — MUST follow exactly | verifier, skillwriter | Iron Laws, hard gates |
| **Technique** | Flexible — follow steps, adapt | debugger, prototype | Numbered workflow |
| **Pattern** | Open — apply principles, not procs | architect | Heuristics, questions |
| **Reference** | Passive — look up as needed | skill registry | Tables, checklists |

### Bulletproofing → verify: all techniques applied before shipping

1. Close every loophole explicitly: "Applies to X AND Y" not "Applies to X"
2. Address spirit vs letter: "Violating spirit = violating rules"
3. Build rationalization table: common excuses → counters
4. Red flags: "should", "probably", "I'll check later"
5. Even 1% rule: >1% chance of recurrence → address it

### Anti-Patterns → verify: each rationalization has matching counter

| Rationalization | Counter |
|-----------------|---------|
| "I already know what skill should say" | Write scenarios first or stop |
| "Just fixing a typo, not changing behavior" | Typos don't change behavior. Behavior change → RED first. |
| "Scenarios are obvious, no need to write" | Writing IS the analysis. Obvious misses subtle modes. |
| "I'll edit inline without scenarios" | Inline edits → scope creep + loopholes. Branch + test. |
| "I tested in my head" | Head tests always pass. Run actual commands. |
| "Old scenarios still pass, no re-run needed" | Fresh verification or it didn't happen. |

### CSO (Claude Search Optimization)

- `description` MUST say "Use when..." NOT "What it does" → verify: frontmatter starts with "Use when"
- Agents discover skills by matching descriptions to task
- Description summarizing workflow → agent skips reading full skill

### Token Efficiency → verify: word count under target

- Frequent-load skills: <200 words
- Others: <500 words
- Every word justifies existence. Cut filler.

### Active Naming → verify: name is verb-first gerund

- Verb-first gerunds: skillwriter (not skill-creation)
- Names describe ACTION, not THING

## Protocol Shells

```
/protocol {
  intent="Create or improve an AGNES skill",
  input={ gap="<what's-missing>", domain="<subject-area>" },
  process=[ /decompose{sections}, /reflect{quality}, /verify{completeness} ],
  output={ result="<SKILL.md>", evidence="<test-with-skill>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /abstract | Extract skill patterns from existing examples |
| /reflect | Self-critique against quality criteria |
| /verify | Check completeness and clarity |

## When NOT to Use

- **No observable failure**: Can't produce 3 scenarios where agent behaves wrongly → don't write skill
- **Pure reference**: Material is reference-only, no behavioral guardrails → use reference doc
- **Already covered**: Existing skill addresses failure mode → extend it
- **Final landing**: This produces candidate; shipper handles shipping → don't deploy here

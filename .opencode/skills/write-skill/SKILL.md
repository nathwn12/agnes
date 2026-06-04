---
id: write-skill
name: write-skill
description: 'Creating a brand-new AGNES skill, editing/improving an existing skill, closing a gap identified during retro, or when an agent demonstrably behaves wrongly without documented guidance.'
phase: "REFLECT / META"
use_when: "Creating a brand-new AGNES skill, editing/improving an existing skill, closing a gap identified during retro, or when an agent demonstrably behaves wrongly without documented guidance."
version: 1.0
---
## Use When

Creating new AGNES skill, editing existing skill, closing gap from retro, or agent demonstrably behaves wrongly without documented guidance.

## Core Concept

> **NO SKILL WITHOUT A FAILING TEST FIRST**

Applies to new skills AND edits. If you can't describe scenario where agent behaves wrongly without skill, you don't know what it should enforce. Writing scenario IS the analysis. Everything else decoration.

## Precise Vocabulary

| Term | Definition |
|------|------------|
| **RED** | Phase writing pressure scenarios before any skill code |
| **GREEN** | Phase writing minimal skill addressing only pressure scenarios |
| **REFACTOR** | Phase closing loopholes, bulletproofing skill |
| **Pressure scenario** | Concrete test case capturing one specific failure mode skill must prevent |
| **Rationalization** | Excuse agent might use to bypass skill's rules |
| **Skill type** | Classification: discipline-enforcing, technique, pattern, reference |
| **Verb-first gerund naming** | Named after ACTION not THING (write-skill not skill-creation) |

## Context Requirements

- Access to `.opencode/skills/<name>/` directory structure
- Existing skill files for naming/formatting conventions
- Real observed agent failures or test outputs to ground scenarios
- Understanding of agent behavior patterns and rationalizations
- This skill produces candidate package; shipper handles final landing

## Workflow

### RED — Write Pressure Scenarios

Create 3-5 concrete scenarios in `.opencode/skills/<name>/tests/pressure-scenarios.md`.

Each captures one failure mode:

```
## Scenario N: <descriptive name>

**Prompt:** "What user says to agent"
**Observed behavior:** What agent does WITHOUT skill (actual bad output)
**Why it's wrong:** Specific harm or deficiency
**Verification:** How to confirm skill fixes this (command, output to check)
```

Rules:
- Specific prompt → specific bad behavior → specific reason wrong
- No hypotheticals. Use real prompts and real bad outputs.
- Can't produce 3 real failures → don't understand problem enough to write skill.

### GREEN — Write Minimal Skill

Address ONLY failures in pressure scenarios. No speculative rules.

- Follow AGNES SKILL.md format (YAML frontmatter + markdown sections)
- Include: frontmatter, core concept, workflow/phases, key rules, anti-patterns table
- Target <200 words for frequently-loaded skills, <500 for others
- After writing, run each pressure scenario against skill, verify compliance
- Document verification result

### REFACTOR — Bulletproof

Close loopholes before shipping:

1. **Identify rationalizations** agents use to bypass skill — document in anti-patterns table
2. **Add explicit counters** for each
3. **Spirit vs letter** — if agent could follow every rule literally yet violate intent, add clarifying rules
4. **Re-run** all pressure scenarios; repeat until bulletproof

## Tool Requirements

- **read** — study existing skills and pressure scenarios
- **write** — create new skill files and scenarios
- **edit** — modify existing skills during GREEN and REFACTOR
- **bash** — run verification commands against scenarios
- **glob** — locate skill files and test directories
- **grep** — search patterns in existing skills

## Output

```
.opencode/skills/<skill-name>/
├── SKILL.md
└── tests/
    └── pressure-scenarios.md
```

## Quality Criteria

### Skill Types

| Type | Flexibility | Example | Format |
|------|------------|---------|--------|
| **Discipline-enforcing** | Rigid — MUST follow exactly | verifier, this skill | Iron Laws, hard gates |
| **Technique** | Flexible — follow steps, adapt | debugger, prototype | Numbered workflow |
| **Pattern** | Open — apply principles, not procedures | architect | Heuristics, questions |
| **Reference** | Passive — look up as needed | skill registry | Tables, checklists |

### Bulletproofing Techniques

1. **Close every loophole explicitly**: "Applies to X AND Y" not "Applies to X"
2. **Address spirit vs letter**: "Violating spirit of these rules is violating rules"
3. **Build rationalization table**: common excuses → counters
4. **Red flags**: "should", "probably", "I'll check later"
5. **Even 1% rule**: pressure scenario with 1% recurrence chance → address it

### Anti-Pattern Table

| Rationalization | Counter |
|-----------------|---------|
| "I already know what skill should say" | Write pressure scenarios first or stop |
| "Just fixing a typo, not changing skill" | Typos don't change behavior. Behavior change? RED first. |
| "Pressure scenarios obvious, don't need to write them" | Writing IS analysis. Obvious scenarios miss subtle failure modes. |
| "This skill is close enough, edit inline" | Inline edits without scenarios → scope creep + loopholes. Branch + test. |
| "I tested this in my head" | Head tests pass every time. Run actual commands. |
| "Old scenarios still pass, re-run not needed" | Run again. Fresh verification or didn't happen. |

### CSO (Claude Search Optimization)

- `description` MUST say "Use when..." NOT "What it does"
- Agents discover skills by matching descriptions against current task
- Description summarising workflow → agent skips reading full skill
- Good: "Use when you need to investigate a failing test in a CI pipeline"
- Bad: "Investigates failing tests by reading logs, reproducing locally, bisecting"

### Token Efficiency

- Frequently-loaded: <200 words
- All others: <500 words
- Every word must justify existence. Cut filler. No greeting, no preamble.

### Active Naming

- Verb-first gerunds: write-skill (not skill-creation)
- Names describe ACTION, not THING
- Existing examples: clarify, explorer, shipper

## When NOT to Use

- **No observable failure pattern**: Can't produce 3 real-world scenarios where agent behaves wrongly → don't write it.
- **Pure informational**: Reference-only with no behavioral guardrails → reference doc instead.
- **Already covered**: Existing skill addresses failure mode → extend it.
- **Final landing**: This skill produces candidate; shipper handles final shipping.

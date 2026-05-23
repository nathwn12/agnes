---
id: skillwriter
phase: "REFLECT / META"
use_when: "Creating a brand-new AGNES skill, editing/improving an existing skill, closing a gap identified during retro, or when an agent demonstrably behaves wrongly without documented guidance."
version: 1.0
---
## Use When

Creating a brand-new AGNES skill, editing/improving an existing skill, closing a gap identified during retro, or when an agent demonstrably behaves wrongly without documented guidance.

## Core Concept

> **NO SKILL WITHOUT A FAILING TEST FIRST**

This applies to new skills AND edits to existing skills. If you can't describe a scenario where the agent behaves wrongly without the skill, you don't know what the skill should enforce. Writing the scenario IS the analysis. Everything else is decoration.

## Precise Vocabulary

| Term | Definition |
|------|------------|
| **RED** | Phase where pressure scenarios are written before any skill code exists |
| **GREEN** | Phase where minimal skill is written to address only the pressure scenarios |
| **REFACTOR** | Phase where loopholes are closed and the skill is bulletproofed |
| **Pressure scenario** | Concrete test case capturing one specific failure mode the skill must prevent |
| **Rationalization** | An excuse an agent might use to bypass the skill's rules |
| **Skill type** | Classification of skills: discipline-enforcing, technique, pattern, reference |
| **Verb-first gerund naming** | Skills named after the ACTION not the THING (e.g. skillwriter not skill-creation) |

## Context Requirements

- Access to `.opencode/skills/<name>/` directory structure for creating skill packages
- Existing skill files to study for naming and formatting conventions
- Real observed agent failures or test outputs to ground pressure scenarios
- Understanding of agent behavior patterns and common rationalizations
- This skill produces the candidate skill package; shipper handles final landing

## Workflow

### RED — Write Pressure Scenarios

Create 3-5 concrete scenarios in `.opencode/skills/<name>/tests/pressure-scenarios.md`.

Each scenario captures one specific failure mode the skill must prevent:

```
## Scenario N: <descriptive name>

**Prompt:** "What the user says to the agent"
**Observed behavior:** What the agent does WITHOUT the skill (actual bad output)
**Why it's wrong:** The specific harm or deficiency
**Verification:** How to confirm the skill fixes this (command to run, output to check)
```

Rules:
- A good scenario: specific prompt → specific bad behavior → specific reason it's wrong
- Do NOT write hypotheticals. Use real prompts and real bad outputs from your own testing or observation.
- If you can't produce 3 real failures, you don't understand the problem well enough to write a skill.

### GREEN — Write Minimal Skill

Address ONLY the failures in your pressure scenarios. Do not add speculative rules.

- Follow the AGNES SKILL.md format (YAML frontmatter + markdown sections)
- Include: frontmatter, core concept, workflow/phases, key rules, anti-patterns table
- Target <200 words for frequently-loaded skills, <500 words for all others
- After writing, run each pressure scenario against the skill and verify compliance
- Document the verification result

### REFACTOR — Bulletproof

Close loopholes before shipping:

1. **Identify rationalizations** agents use to bypass the skill — document in the anti-patterns table
2. **Add explicit counters** for each rationalization
3. **Spirit vs letter** — if an agent could follow every rule literally yet violate the intent, add clarifying rules
4. **Re-run** all pressure scenarios; repeat until bulletproof

## Tool Requirements

- **read** — to study existing skills and pressure scenarios
- **write** — to create new skill files and pressure scenarios
- **edit** — to modify existing skills during GREEN and REFACTOR phases
- **bash** — to run verification commands against pressure scenarios
- **glob** — to locate skill files and test directories
- **grep** — to search for patterns in existing skills

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
| **Technique** | Flexible — follow steps, adapt to context | debugger, prototype | Numbered workflow |
| **Pattern** | Open — apply principles, not procedures | architect | Heuristics, questions |
| **Reference** | Passive — look up as needed | skill registry | Tables, checklists |

### Bulletproofing Techniques

1. **Close every loophole explicitly**: "Applies to X AND Y" not "Applies to X"
2. **Address spirit vs letter**: "Violating the spirit of these rules is violating the rules"
3. **Build the rationalization table**: common excuses mapped to counters
4. **Red flags**: watch for "should", "probably", "I'll check later"
5. **Even 1% rule**: If a pressure scenario has even 1% chance of recurring, address it

### Anti-Pattern Table

| Rationalization | Counter |
|-----------------|---------|
| "I already know what the skill should say" | Write the pressure scenarios first or stop |
| "I'm just fixing a typo, not changing the skill" | Typos don't change behavior. Is this actually a behavior change? If yes, RED first. |
| "The pressure scenarios are obvious, I don't need to write them down" | Writing them IS the analysis. Obvious scenarios miss subtle failure modes. |
| "This skill is close enough, I'll just edit it inline" | Inline edits without scenarios produce scope creep and loopholes. Branch + test. |
| "I tested this in my head" | Head tests pass every time. Run actual commands. |
| "The old scenarios still pass, I don't need to re-run" | Run them again. Fresh verification or it didn't happen. |

### CSO (Claude Search Optimization)

- The `description` field MUST say "Use when..." NOT "What it does"
- Agents discover skills by matching descriptions against current task
- A description that summarises workflow causes the agent to skip reading the full skill
- Good: "Use when you need to investigate a failing test in a CI pipeline"
- Bad: "Investigates failing tests by reading logs, reproducing locally, and bisecting"

### Token Efficiency

- Frequently-loaded skills: target <200 words
- All others: target <500 words
- Every word must justify its existence. Cut filler. No greeting, no preamble.

### Active Naming

- Verb-first gerunds: skillwriter (not skill-creation)
- Names describe the ACTION, not the THING
- Existing examples: clarifier, explorer, shipper

## When NOT to Use

- **No observable failure pattern**: If you cannot produce at least 3 real-world scenarios where an agent behaves wrongly without the skill, do not write it.
- **Pure informational content**: If the material is reference-only with no behavioral guardrails, consider a reference document instead of a skill.
- **Already covered**: If an existing skill already addresses the failure mode, extend it rather than creating a new one.
- **Final landing**: This skill produces the candidate only; shipper handles the final shipping — do not use this skill for the deployment step.

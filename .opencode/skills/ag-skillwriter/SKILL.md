---
name: ag-skillwriter
description: Create and refine AGNES skills via TDD — write pressure scenarios first, watch agents fail without the skill (RED), write the skill (GREEN), close loopholes (REFACTOR)
---

## Phase: REFLECT / META

Use when: creating a brand-new AGNES skill, editing/improving an existing skill, closing a gap identified during retro, or when an agent demonstrably behaves wrongly without documented guidance.

## Iron Law

> **NO SKILL WITHOUT A FAILING TEST FIRST**

This applies to new skills AND edits to existing skills. If you can't describe a scenario where the agent behaves wrongly without the skill, you don't know what the skill should enforce. Writing the scenario IS the analysis. Everything else is decoration.

## The TDD Cycle for Skills

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

## Skill Types

| Type | Flexibility | Example | Format |
|------|------------|---------|--------|
| **Discipline-enforcing** | Rigid — MUST follow exactly | ag-verifier, this skill | Iron Laws, hard gates |
| **Technique** | Flexible — follow steps, adapt to context | ag-debugger, ag-prototype | Numbered workflow |
| **Pattern** | Open — apply principles, not procedures | ag-architect | Heuristics, questions |
| **Reference** | Passive — look up as needed | skill registry | Tables, checklists |

## CSO (Claude Search Optimization)

- The `description` field MUST say "Use when..." NOT "What it does"
- Agents discover skills by matching descriptions against current task
- A description that summarises workflow causes the agent to skip reading the full skill
- Good: "Use when you need to investigate a failing test in a CI pipeline"
- Bad: "Investigates failing tests by reading logs, reproducing locally, and bisecting"

## Token Efficiency

- Frequently-loaded skills: target <200 words
- All others: target <500 words
- Every word must justify its existence. Cut filler. No greeting, no preamble.

## Active Naming

- Verb-first gerunds: ag-skillwriter (not ag-skill-creation)
- Names describe the ACTION, not the THING
- Existing examples: ag-clarifier, ag-explorer, ag-shipper

## Bulletproofing Techniques

1. **Close every loophole explicitly**: "Applies to X AND Y" not "Applies to X"
2. **Address spirit vs letter**: "Violating the spirit of these rules is violating the rules"
3. **Build the rationalization table**: common excuses mapped to counters
4. **Red flags**: watch for "should", "probably", "I'll check later"
5. **Even 1% rule**: If a pressure scenario has even 1% chance of recurring, address it

## Anti-Pattern Table

| Rationalization | Counter |
|-----------------|---------|
| "I already know what the skill should say" | Write the pressure scenarios first or stop |
| "I'm just fixing a typo, not changing the skill" | Typos don't change behavior. Is this actually a behavior change? If yes, RED first. |
| "The pressure scenarios are obvious, I don't need to write them down" | Writing them IS the analysis. Obvious scenarios miss subtle failure modes. |
| "This skill is close enough, I'll just edit it inline" | Inline edits without scenarios produce scope creep and loopholes. Branch + test. |
| "I tested this in my head" | Head tests pass every time. Run actual commands. |
| "The old scenarios still pass, I don't need to re-run" | Run them again. Fresh verification or it didn't happen. |

## Wiring

When this skill produces a new skill, the output directory must be:

```
.opencode/skills/<skill-name>/
├── SKILL.md
└── tests/
    └── pressure-scenarios.md
```

Ag-shipper handles the final landing. This skill produces the candidate.

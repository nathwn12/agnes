---
name: write-skill
id: write-skill
phase: 'REFLECT / META'
description: 'Creating a brand-new AGNES skill, editing/improving an existing skill, closing a gap identified during retro, or when an agent demonstrably behaves wrongly without documented guidance.'
---
## RULES
- NO SKILL WITHOUT A FAILING TEST FIRST. Applies to new AND edits
- Can't describe scenario where agent fails without skill → don't understand problem enough
- RED: write 3-5 pressure scenarios in `.opencode/skills/<name>/tests/pressure-scenarios.md`. Each: prompt, bad behavior, reason wrong, verification. Can't produce 3 real failures → don't write
- GREEN: write minimal skill addressing ONLY failures in scenarios. No speculative rules. Target <200 words (frequently loaded) or <500 (others)
- REFACTOR: identify rationalizations, close loopholes. Re-run all scenarios until bulletproof
- Skill types: Discipline-enforcing (rigid), Technique (flexible), Pattern (principles), Reference (lookup)
- `description` MUST say "Use when..." not "What it does"
- Verb-first gerund naming: write-skill (not skill-creation)

## FLOW
1. RED — Write pressure scenarios (3-5 real failure cases)
2. GREEN — Write minimal skill addressing only those failures
3. REFACTOR — Bulletproof: close loopholes, re-run scenarios
4. Produce: `.opencode/skills/<name>/SKILL.md` + `tests/pressure-scenarios.md`

## TRIGGERS
- Creating new AGNES skill, editing/improving existing skill
- Closing gap identified during retro
- Agent demonstrably behaves wrongly without documented guidance

## NEXT
- tdd — write tests for new skill

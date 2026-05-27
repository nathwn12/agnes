---
id: feedback-receiver
name: feedback-receiver
description: 'Received code review feedback (from human or automated reviewer), need to evaluate and act on comments without blind acceptance.'
phase: "REVIEW"
use_when: "Received code review feedback (from human or automated reviewer), needing to evaluate or merge external review feedback and act on comments without blind acceptance."
version: 1.2
---

# feedback-receiver

**Tradeoff:** Trusting reviewer expertise accelerates iteration; blind acceptance risks implementing incorrect or out-of-context suggestions.

## Core Concept

Feedback requires technical evaluation, not performative agreement. Verify before implementing. Push back with evidence when wrong.

**Core principle:** Technical correctness over social comfort. The code change is the acknowledgment.

## Precise Vocabulary

- **Performative agreement**: Agreeing without technical evaluation
- **Technical acknowledgment**: Confirming a fix with specific evidence (commit hash, what changed)
- **Reasoned pushback**: Disagreeing with codebase-backed reasoning
- **YAGNI**: You Ain't Gonna Need It — rejecting speculative generalization
- **Graceful correction**: Admitting error cleanly when pushback was wrong

## Context Requirements

| Source | Approach |
|--------|----------|
| **Trusted** (human partner, senior engineer) | Quick verify, implement if sound. Push back only when clearly wrong. |
| **External** (automated tool, unfamiliar reviewer) | Skeptical but fair. Thorough verify. YAGNI check applies. |

Never implement partially understood feedback — items may be related, partial understanding leads to wrong implementation.

## Workflow

### 1. READ

Read ALL feedback completely before reacting. → verify: full feedback read, nothing skipped

**Output:** Complete inventory of all feedback items

### 2. UNDERSTAND

Restate each requirement in your own words. If unclear — stop. Ask for clarification. Never assume intent. → verify: every item restatable without ambiguity

**Output:** Clear restatement of each requirement

### 3. VERIFY

Check each item against codebase reality:
- Is the criticism technically correct for THIS codebase?
- Does it break existing functionality?
- Is there a reason for current implementation?
- Does the reviewer understand full context?
- YAGNI: grep for actual consumers before generalizing → verify: grep evidence per claim

**Output:** Technical validity assessment per item

### 4. EVALUATE

Accept or decline each item. A suggestion may be correct in theory but wrong for this project's constraints, conventions, or phase. Push back when it:
- Breaks existing functionality
- Lacks codebase context
- Violates YAGNI
- Is technically incorrect for this stack/platform
- Ignores architectural decisions → verify: decision recorded per item (accept/decline/refer)

**Output:** Accepted/declined per item with reasoning

### 5. RESPOND

Either:
- **Technical acknowledgment**: "Fixed in abc123, added edge case test."
- **Reasoned pushback**: "This pattern exists in 3 other places — changing just this one would be inconsistent."
- **Graceful correction**: "You were right — checked X, it does Y. Fixing."

GitHub: reply in comment thread, not top-level PR.

**Never:** "You're absolutely right!" / "Great point!" / "Let me implement that now" (before verify). → verify: response contains no performative agreement

**Output:** Thread replies or commit messages per item

### 6. IMPLEMENT

One item at a time. Priority: blocking issues → simple fixes → complex fixes. Test each. Commit each. No batching. → verify: each fix tested individually, no regressions

**Output:** Fixed code with passing tests

## Flow Diagram

```
[feedback] → [READ] → [UNDERSTAND] → [VERIFY] → [EVALUATE] → [RESPOND] → [IMPLEMENT] → [acknowledgment/pushback]
                                                                                      ↑ error │
                                                                                      └────────┘
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| grep | VERIFY, EVALUATE | feedback claim | codebase evidence |
| read | READ, VERIFY | source file | file content |
| bash | VERIFY, IMPLEMENT | test command | pass/fail |
| edit | IMPLEMENT | current code | fixed code |
| write | RESPOND | response text | comment/reply |
| git | RESPOND, IMPLEMENT | changes | commit hash |

## Examples

| Pattern | ❌ Wrong | ✅ Right |
|---------|----------|----------|
| Performative agreement | "You're absolutely right!" | "Fixed in abc123 — added edge case test." |
| Unclear items | Implement known, ask about rest later | "Need clarification on items 4,5 before proceeding." |
| YAGNI pushback | Implement generalization | "No consumers exist. YAGNI. Revisit when usage emerges." |
| Graceful correction | Long apology + defensiveness | "You were right — checked X, it does Y. Fixing." |
| Wrong suggestion | Implement silently | "gap: endpoint has no callers. Remove it? Or is there usage I'm missing?" |

## Output

- Technical acknowledgment with specific evidence (commit hash, what changed)
- Reasoned pushback with codebase citations
- Graceful correction when wrong

## Quality Criteria

- → verify: No performative agreement phrases in response
- → verify: Correct feedback stated without excessive deference
- → verify: Wrong feedback rebutted with codebase-backed technical reasoning
- → verify: Implementation one item at a time, tested and committed individually
- → verify: Unclear items clarified before any implementation begins
- → verify: Pushback is specific and technical, not defensive
- → verify: GitHub replies target specific comment thread, not top-level PR

## Protocol Shells

All feedback processing follows protocol shell format:

/protocol {
  intent="Evaluate and act on code review feedback",
  input={ feedback="<review-comments>", original="<code-diff>" },
  process=[ /verify{validity}, /compare{alternatives}, /synthesize{action-plan} ],
  output={ result="<accepted-or-declined>", actions="<changes-to-make>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /verify | Check each feedback item for technical validity |
| /compare | Evaluate alternative fixes when feedback suggests one |
| /synthesize | Combine accepted feedback into action plan |

## When NOT to Use

No code review feedback, purely stylistic feedback, or reviewer not open to technical discussion.

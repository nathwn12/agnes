---
name: process-feedback
id: process-feedback
phase: REVIEW
description: 'Received code review feedback (from human or automated reviewer), need to evaluate and act on comments without blind acceptance.'
---
## RULES
- Technical evaluation, not performative agreement. Verify before implementing
- Technical correctness over social comfort
- Never implement partially understood feedback. Stop and clarify first
- One item at a time. Test each. Commit each. No batching

## FLOW
1. READ all feedback before reacting
2. UNDERSTAND: restate in own words. If unclear, ask
3. VERIFY: check against codebase. Is criticism technically correct?
4. EVALUATE: technically sound for THIS codebase?
5. RESPOND: technical acknowledgment (commit hash + what changed) OR reasoned pushback (with citations)
6. IMPLEMENT: one item at a time. Test each. Commit each

## SOURCE-SPECIFIC
- Trusted source: high confidence, verify quickly, implement if sound
- External/unfamiliar: skeptical but fair, verify thoroughly, YAGNI aggressively

## FORBIDDEN
- "You're absolutely right!" "Great point!" "Excellent feedback!" "Thanks!"
- Instead: restate requirement, ask questions, push back with reasoning, or start working

## YAGNI CHECK
- Reviewer says "implement properly" (generalized)? Grep for actual usage
- Unused → push back. Used → implement properly

## PUSHBACK TRIGGERS
- Breaks existing functionality, reviewer lacks context, violates YAGNI, technically incorrect, ignores constraints, conflicts with ADRs

## TRIGGERS
- Received code review feedback needing evaluation
- Need to merge external review feedback without blind acceptance

## OUTPUT
- Technical acknowledgment with evidence (commit hash, what changed)
- Reasoned pushback with codebase citations
- Graceful correction when wrong

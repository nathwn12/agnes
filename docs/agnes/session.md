# Session Management

A [session](https://code.claude.com/docs/en/dictionary/session) is one bounded run of interaction with an agent. It starts empty, accumulates context, and degrades as it grows. Knowing when to end one session and start another is the difference between sharp output and sloppy output.

## The curve

Every session follows the same curve:

```
Sharp ┃▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░  Dumb
      ┃ SMART ZONE          DUMB ZONE
      ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      tokens / turns → 
```

Early in a session the agent is sharp — recall is good, relationships between symbols are clear. This is the **smart zone**. As the session grows, each token's [attention budget](https://code.claude.com/docs/en/dictionary/attention-budget) spreads across more competitors. Signal on meaningful relationships shrinks; noise crowds in. This is the **dumb zone**. Same model, same harness — just more context.

On frontier models the dumb zone commonly begins around 100k tokens. The exact threshold varies by model and task complexity.

## The three session boundaries

| Action | What happens | Lossiness | When |
|--------|-------------|-----------|------|
| **Clear** | End session. Start fresh. | Everything lost | Task done, or session is deep in dumb zone and no useful state to carry |
| **Compact** | Summarise session in-memory, seed fresh session | Lossy — detail traded for headroom | Session is deep in dumb zone but has useful state worth carrying |
| **Handoff** | Write artifact to disk, next session reads it | Lossless (on what was written) | Switching roles (planner → builder), fanning out to parallel sessions, or saving work for later |

### Clear

End the current session and start a completely fresh one. The next message begins with an empty [context window](https://code.claude.com/docs/en/dictionary/context-window).

Use when:
- The goal is met — start fresh on the next task
- The session is deep in the dumb zone with nothing worth carrying forward
- The approach was wrong — trying again from scratch is cheaper than correcting course

### Compact

The previous session's history is summarised into a prompt that seeds a fresh session. All interaction history is dropped; only the summary carries forward. Lossy — nuance, tangents, and discarded alternatives are gone.

Use when:
- The session is in the dumb zone but decisions or context are worth keeping
- You're mid-task and the context is bloated but the goal hasn't changed
- The model is still on the right track but losing precision

How to compact:
1. Update `plan.md` — ensure all done items are `[x]` and pending items reflect reality
2. Review what's load-bearing: schema decisions, file paths changed, test results, the current plan
3. Write a summary prompt: "We are doing X. So far we have done A, B, C. Current state: D. Next step: E."
4. Clear the session
5. Start the new session with the summary as the first message
6. Re-read `goal.md` and `plan.md` — they survived clearing and still hold

### Handoff

A [handoff artifact](./handoff.md) is written to disk — structured, explicit, reviewable. The next session opens with a pointer to the artifact and works from it as its brief. Lossless within what was written.

Use when:
- Switching roles (planner → implementer, researcher → builder)
- The user says "handoff" or "stop" — save for later or for another agent
- Three hypotheses failed during debugging — architecture is wrong, not code
- Fanning out to parallel sessions (each gets its own handoff artifact)

## Decision tree

```
Session feeling heavy or agent getting sloppy?
├── Is the goal met?
│   ├── YES → Clear. You're done.
│   └── NO  → Is there useful state to carry?
│       ├── NO  → Clear. Start fresh with just the goal and plan.
│       └── YES → Is this a role switch or parallel fan-out?
│           ├── YES → Handoff. Write artifact, next session reads it.
│           └── NO  → Compact. Summarise, clear, re-seed.
```

## Relationship to state files

| File | Role across sessions |
|------|---------------------|
| `goal.md` | Survives clearing. Always re-read at session start. |
| `plan.md` | Survives clearing. Checklist persists across sessions. |
| `handoff.md` | Written at session end. Read at next session start if handoff path. |

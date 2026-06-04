---
name: instinct
id: instinct
phase: META
description: 'Cross-session context retention, pattern learning, instinct lifecycle management. Agents remember what works, share patterns, promote knowledge, create skills from repeated behavior.'
---
## RULES
- Instinct = learned pattern + confidence (0.0-1.0). Observed, not written
- 3+ pattern observations in a session → autonomous instinct creation
- Confidence <0.1 → auto-archive. Archived recoverable, never deleted
- Confidence ≥0.85 and 10+ successful apps → flag as skill candidate
- Success rate <60% after 5+ apps → flagged for review

## FLOW
1. Observation — detect recurring pattern
2. Creation — record as instinct, initial confidence 0.5-0.7
3. Application — trigger on similar context, follow action
4. Reinforcement — success +0.05 to +0.15 (cap 1.0)
5. Punishment — failure -0.1 to -0.3
6. Decay — unused: 5%/week
7. Promotion — high-confidence project → global
8. Archive — below threshold (default 0.1) archived

## CONFIDENCE
- Initial 0.6, reinforce +0.08, punish -0.15, decay 0.05/week, min 0.1, promote 0.85
- Clamped [0.0, 1.0]. Decay from last-application timestamp

## STORAGE
- Project: `.agnes/instincts/`, Global: `~/.config/opencode/instincts/`
- Evolved output: `.agnes/evolved/`

## TRIGGERS
- Cross-session context retention, pattern learning from repeated behavior
- Autonomous skill creation from observed patterns
- Confidence-based reinforcement with decay

## AVOID
- No session history or repeated patterns, one-off tasks
- Pattern already covered by existing skill, secrets/credentials

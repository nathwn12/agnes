---
name: question-gate
description: Pause at decisions with structured options. Use for structural changes, architecture, multi-file work.
---

# Question-Gate

Default mode (active unless YOLO triggered).

Gate on: 3+ files, architecture changes, new deps, structural changes.
Skip: single-file fixes, typos, read-only, config tweaks.

Present:
```
Options:
✅ 1) [Recommended] — why
2) [Alternative] — tradeoff
3) [Manual / different]
```

User picks → execute. User says `--yolo`/`--auto` → switch to YOLO.

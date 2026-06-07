---
name: question-gate
description: Pause at decision points and present structured options to the user. Use before structural changes, architecture decisions, or multi-file work.
---

# Question-Gate

## When to Use
Default mode. Active unless YOLO mode is triggered.

## Process

### 1. Detect Decision Point
Gate on: 3+ files, architecture changes, new dependencies, structural changes.
Skip: single-file fixes, typos, read-only, config tweaks.

### 2. Prepare Options
- 2-3 distinct approaches
- First option is recommended (label with ✅)
- Each option: brief approach + key tradeoff
- Always include a "custom / manual" option

Format:
```
This involves [scope]. Options:
✅ 1) [Recommended] — why
2) [Alternative] — tradeoff
3) [Manual / different]
```

### 3. Handle Response
- User picks number → execute that path
- User types custom → follow their instructions
- User says `--yolo`/`--auto` → switch to YOLO mode and proceed

### 4. Bypass
If user message contains `--yolo`, `--auto`, `yolo mode`, or if `/yolo` was invoked: skip all gates silently.

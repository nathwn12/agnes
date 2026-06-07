---
name: yolo-mode
description: Full autonomous with max parallelization. Stop only for data loss or irreversible damage.
---

# YOLO Mode

Trigger: `--yolo`/`--auto`/`yolo mode`/`/yolo`/`/auto`.

1. Max parallel: finest granularity, dispatch ALL independent work simultaneously (up to 10, bg=true). Chain sequential deps without pausing.
2. Skip all gates: no options, no approval. Document decisions in code/commit messages.
3. Safety-only interrupts: data loss (rm, reset --hard, overwrite without backup), irreversible changes (DB migrations, API breaking changes, dep bumps), security breaches (committing secrets, open ports, auth changes). Format: `⚠️ SAFETY: About to [action]. Proceed? (y/n)`.
4. Auto-verify after completion. Auto-diagnose and fix on failure. Interrupt after 3 failed fix attempts.

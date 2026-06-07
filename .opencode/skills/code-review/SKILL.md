---
name: code-review
description: One-pass code review by subagent — quality, correctness, spec compliance.
---

# Code Review

After implementation, before final verification, or on request.

1. Dispatch reviewer subagent with: files changed, task description, concerns.
2. Categories: Critical (bug/security/data loss — must fix), Important (maintenance/performance — should fix), Minor (style/naming — nice to fix).
3. Fix issues, verify, move on. If 3+ Critical issues, consider second review pass.
4. Question-gate: present summary + ask if user wants changes. YOLO: auto-fix Critical+Important.

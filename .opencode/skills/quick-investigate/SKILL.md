---
name: quick-investigate
description: Find root cause before fixing. Use for any bug, test failure, or crash.
---

# Quick Investigate

1. Root cause (mandatory before fix): read error fully, reproduce, check `git diff`, trace code path.
2. One hypothesis at a time. Test minimally. Verify before next hypothesis.
3. Fix + verify: apply fix, run auto-verify.
4. 3 strikes: STOP fixing. Gate mode → report + ask guidance. YOLO → escalate to broader context.

Parallel: dispatch one subagent per failure domain for independent failures.

---
description: Remove dead code and consolidate duplicates
subtask: true
---

# Refactor Clean: $ARGUMENTS

1. Detect: `knip` → unused exports, `depcheck` → unused deps, `ts-prune` → unused TS exports. Manual: dead functions, vars, imports, commented code, unreachable code.
2. Remove in order: unused imports → private funcs → exported funcs → types → files. Search usage first, check tests, document in commit.
3. Consolidate: extract utility, base class, HOC, shared constants.
4. Verify: build + test + lint pass.

```
Removed: file.ts:func (unused)
Consolidated: formatDate + formatDateTime → dateUtils.format()
```

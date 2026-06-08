---
description: Fix build/TS errors with minimal changes
subtask: true
---

# Build Fix: $ARGUMENTS

1. `npx tsc --noEmit` — collect errors
2. Fix each with minimal change. Verify after each.
3. Final: tsc=0, build=ok, tests=pass

DO: correct types, add imports, fix syntax, minimal diff.
DON'T: refactor, add features, any type, @ts-ignore.

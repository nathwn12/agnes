---
description: Update codemaps for codebase navigation
subtask: true
---

# Update Codemaps: $ARGUMENTS

Generate/update `docs/CODEMAPS/ARCHITECTURE.md`, `MODULES.md`, `FILES.md`.

Each: purpose, location, key files, deps, exports, usage example.

Scan dirs → parse imports → build dep graph → generate markdown.

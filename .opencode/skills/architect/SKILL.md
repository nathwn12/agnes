---
name: architect
id: architect
phase: 'RESEARCH / DESIGN'
description: 'Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability.'
---
## RULES
- Deletion test: delete module. Complexity vanishes = shallow (pass-through). Complexity reappears across callers = deep
- Seam rule: 1 adapter = hypothetical seam. 2 adapters = real seam
- Interface is test surface: callers and tests cross same seam. Test bypasses interface = wrong shape
- Old unit tests on shallow modules become waste after deepening — delete
- Vocabulary: module, interface, implementation, depth, seam, adapter, leverage, locality. Avoid: component, service, API, boundary
- Dependency categories: in-process (merge), local-substitutable (stand-in), remote-but-owned (port+adapter), true-external (injected port + mock)

## FLOW
1. Explore: CONTEXT.md + ADRs, walk codebase with deletion test, note friction
2. Present candidates: numbered files, problem, solution, benefits. Rating: Strong/Worth/Speculative
3. Grilling loop: walk design tree with user. Update CONTEXT.md inline. ADR for load-bearing rejections
4. Interface design (design it twice): 3+ parallel agents (min surface, max flexibility, optimise caller, ports/adapters). Compare by depth/locality/seam. Opinionated recommendation
5. Deepening: classify deps, merge or port, delete obsolete unit tests, write interface tests

## TRIGGERS
- Codebase feels hard to change, modules tightly coupled
- Need refactoring for testability and AI-navigability

## NEXT
- planner: route final design into implementation plan

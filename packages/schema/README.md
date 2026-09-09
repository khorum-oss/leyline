# @leyline/schema

The canonical, serializable Leyline contract.

The schema document holds the truth (AD1). The TypeScript DSL, an AI agent, a
code generator, and a hand-written JSON file all count as equally valid
producers. Zod holds the single definition of every type, and the published JSON
Schema exports from it (AD9), so a non-TypeScript producer validates against an
identical contract.

## Present

- Schema version rules and additive-evolution checks (AD8)
- The v1 semantic vocabulary: node kinds, surface types, capability kinds
- Deterministic, opaque identifiers (AD12, I5)
- Prototype and injection hygiene for untrusted documents (I7)
- The document envelope every Leyline document carries

## Next — delivery stage 1

Node and surface definitions, graph validation (dangling targets, unreachable
nodes, undeclared capabilities), the requirements block, change-description
schemas, and JSON Schema export.

# @khorum-oss/leyline-schema

## 1.0.0

### Minor Changes

- 19fb64b: `@khorum-oss/leyline-agent`: the control plane as self-describing operations, with introspection that names every surface, its description, its current renderer, and which are on screen. `@khorum-oss/leyline-agent/mcp` serves them over MCP with the SDK as an optional peer, so the main entry point has no dependencies.

  An initiator may now carry an `attested` fact the transport fills and a caller cannot, with policy as the enforcement point.

  `@khorum-oss/leyline-core` fixes a hole in `apply` and `validate`: both read only the identifier from their argument now, so a caller cannot validate one change and commit another under the same proposal id.

- 845ae22: The control plane: propose, validate, apply, revert, confirm, and hydrate, with policy consulted before every one of them. Ranked renderer registries resolve over a catalogue the application publishes, so a change may name a renderer and never supply one.

  Changes are classified by what they disturb — a guard attachment applies live, a graph change rebuilds the interpreter and restores its position. Revert replays the log without the reverted change, refusing with a precise explanation when a later change would no longer validate.

  `@khorum-oss/leyline-schema` gains the `change.revert` change kind, so reverting travels the same path as everything else.

- 9d23a9d: The React adapter: `WorkflowView` resolves each active region and surface through the registry and hands it to whichever component claimed it, with built-in fallbacks so an unclaimed surface draws a placeholder rather than nothing.

  Registries can now claim regions as well as surfaces. A renderer match takes `target: 'surface' | 'region'`, defaulting to `surface`, plus `nodeKind` for region matches — so a container is swappable the same way a table is.

- 5774a22: Section nodes: a node kind that contains other nodes and says how they run together — `one` child at a time or `many` at once. Children are named rather than nested, so transition targets stay plain identifiers. Containment is validated as its own structure, and a transition may not land inside a section it does not belong to.

  End users become a fourth initiator kind, with `section.reorder-children` and `section.move-child` expressing personalization as ordinary control-plane changes.

  `Snapshot` now exposes an `ActiveRegion` tree rather than a single node, since a section running in `many` mode has several children active at once. `walkRegions` and `activeSurfaces` traverse it.

- b4aa5f5: Schema foundation: the canonical workflow document, graph and capability validation, deterministic addressing, change descriptions, and published JSON Schema artifacts. `@khorum-oss/leyline-core` now takes its issue shape from `@khorum-oss/leyline-schema`, so a binding failure and a validation issue are one format.
- a426e6d: `@khorum-oss/leyline-dsl`: a builder that checks node references, capability names, and context fields where they are written, by accumulating what the workflow declared into type unions. Output is byte-identical to a hand-written document.

  `@khorum-oss/leyline-schema` gains `serializeWorkflow`, which makes canonical form a published function rather than a convention — the authored document, with identifiers an author left out still left out.

### Patch Changes

- 090e86a: The headless runtime: `createWorkflow` binds a document to a capability bundle, verifies every requirement up front, and runs it over the statechart facade. Snapshots expose an active region tree with resolved surfaces and prop-getters, sharing structure so identity comparison is a valid change check.

  The trace stream ships with ring-buffer and console sinks, a redaction hook that runs before any consumer sees a payload, per-kind filtering, and `export()`. Sinks may be attached at construction, so binding and the first service invocation are observable.

  `@khorum-oss/leyline-schema` exports a `JsonValue` type for payloads.

- ca5c570: Drops `fixtures` from the published file list. The fixture corpus lives in `src/fixtures/` as test data and has never been part of the tarball, so the entry promised a directory the package does not ship.
- b914536: Fixes the SonarQube quality gate findings and adds the rules behind them to `pnpm lint`, so they surface locally. The reorder permutation check now compares sets rather than sorting both sides as text, and `validateChange` and `validateWorkflow` are each split into one function per case.

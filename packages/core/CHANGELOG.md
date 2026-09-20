# @khorum-oss/leyline-core

## 1.0.0

### Minor Changes

- 845ae22: The control plane: propose, validate, apply, revert, confirm, and hydrate, with policy consulted before every one of them. Ranked renderer registries resolve over a catalogue the application publishes, so a change may name a renderer and never supply one.

  Changes are classified by what they disturb — a guard attachment applies live, a graph change rebuilds the interpreter and restores its position. Revert replays the log without the reverted change, refusing with a precise explanation when a later change would no longer validate.

  `@khorum-oss/leyline-schema` gains the `change.revert` change kind, so reverting travels the same path as everything else.

- 090e86a: The headless runtime: `createWorkflow` binds a document to a capability bundle, verifies every requirement up front, and runs it over the statechart facade. Snapshots expose an active region tree with resolved surfaces and prop-getters, sharing structure so identity comparison is a valid change check.

  The trace stream ships with ring-buffer and console sinks, a redaction hook that runs before any consumer sees a payload, per-kind filtering, and `export()`. Sinks may be attached at construction, so binding and the first service invocation are observable.

  `@khorum-oss/leyline-schema` exports a `JsonValue` type for payloads.

- 9d23a9d: The React adapter: `WorkflowView` resolves each active region and surface through the registry and hands it to whichever component claimed it, with built-in fallbacks so an unclaimed surface draws a placeholder rather than nothing.

  Registries can now claim regions as well as surfaces. A renderer match takes `target: 'surface' | 'region'`, defaulting to `surface`, plus `nodeKind` for region matches — so a container is swappable the same way a table is.

- 5774a22: Section nodes: a node kind that contains other nodes and says how they run together — `one` child at a time or `many` at once. Children are named rather than nested, so transition targets stay plain identifiers. Containment is validated as its own structure, and a transition may not land inside a section it does not belong to.

  End users become a fourth initiator kind, with `section.reorder-children` and `section.move-child` expressing personalization as ordinary control-plane changes.

  `Snapshot` now exposes an `ActiveRegion` tree rather than a single node, since a section running in `many` mode has several children active at once. `walkRegions` and `activeSurfaces` traverse it.

- 52e383c: `@khorum-oss/leyline-core`: the parts of the renderer contract that were identical in three
  adapters now live here, which is where the constitution says they belong.

  - `SurfaceRendererProps` and `RegionRendererPropsOf<TSurfaceSlot, TRegionSlot>`
    describe what a renderer receives, with the slot left as the type parameter —
    the one thing that genuinely differs, because Svelte mounts a dynamic
    component rather than calling a render function.
  - `regionIdentity(plan)` and `surfaceIdentity(plan)` hand back the identity
    fields a slot carries. Every adapter was writing the same conditional spread
    for `description`, and the reason it is conditional is
    `exactOptionalPropertyTypes` — a constraint from this package, so the
    ready-made object belongs here too.
  - `@khorum-oss/leyline-core/testing` now publishes the §2 conformance scenario:
    `referenceDocument`, `scenarioBundle`, `scenarioCatalogue`, `openScenario`,
    `applyChange`, `swapActionsToCardGrid`. Standing the scenario up is not
    framework work, and an adapter author outside this repository gets the same
    fixture the ones inside it are held to.

  The adapters keep the part that is actually about their framework and drop the
  rest. No public adapter API changed.

- 7622872: Svelte and vanilla adapters: `WorkflowView` for Svelte, `mount` for plain DOM, both rendering the same document the React adapter does.

  `@khorum-oss/leyline-core` gains `buildRenderPlan`, which resolves an active tree into what each region and surface is drawn by. The walk, the registry questions, and the fallback selection were about to be written a third time, so they live in the core now and an adapter's whole job is turning a plan into its framework's output. The React adapter is rewritten on top of it with no test changes.

### Patch Changes

- 19fb64b: `@khorum-oss/leyline-agent`: the control plane as self-describing operations, with introspection that names every surface, its description, its current renderer, and which are on screen. `@khorum-oss/leyline-agent/mcp` serves them over MCP with the SDK as an optional peer, so the main entry point has no dependencies.

  An initiator may now carry an `attested` fact the transport fills and a caller cannot, with policy as the enforcement point.

  `@khorum-oss/leyline-core` fixes a hole in `apply` and `validate`: both read only the identifier from their argument now, so a caller cannot validate one change and commit another under the same proposal id.

- 763d1f8: `TRACE_KINDS`, `TraceKind`, and `TraceEvent` are now re-exported from `@khorum-oss/leyline-schema` rather than declared a second time in the core. The public API is unchanged; the definition is now singular, and published as JSON Schema alongside the other control-plane contracts.
- b914536: Fixes the SonarQube quality gate findings and adds the rules behind them to `pnpm lint`, so they surface locally. The reorder permutation check now compares sets rather than sorting both sides as text, and `validateChange` and `validateWorkflow` are each split into one function per case.
- b4aa5f5: Schema foundation: the canonical workflow document, graph and capability validation, deterministic addressing, change descriptions, and published JSON Schema artifacts. `@khorum-oss/leyline-core` now takes its issue shape from `@khorum-oss/leyline-schema`, so a binding failure and a validation issue are one format.
- 52e383c: `@khorum-oss/leyline-core`: describing a transition now costs nothing when nothing is
  reading the trace stream. The engine flattened the active tree twice and
  compared the results on every published snapshot, and the only consumer of that
  work was a `workflow.transition` event that an unobserved stream then discarded.
  The engine observer's `guardTracingEnabled()` becomes `tracingEnabled(kind)` and
  both hot paths ask it before assembling an argument (AD15).
- Updated dependencies [19fb64b]
- Updated dependencies [845ae22]
- Updated dependencies [090e86a]
- Updated dependencies [ca5c570]
- Updated dependencies [9d23a9d]
- Updated dependencies [5774a22]
- Updated dependencies [b914536]
- Updated dependencies [b4aa5f5]
- Updated dependencies [a426e6d]
  - @khorum-oss/leyline-schema@1.0.0

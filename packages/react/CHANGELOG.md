# @khorum-oss/leyline-react

## 1.0.0

### Minor Changes

- 9d23a9d: The React adapter: `WorkflowView` resolves each active region and surface through the registry and hands it to whichever component claimed it, with built-in fallbacks so an unclaimed surface draws a placeholder rather than nothing.

  Registries can now claim regions as well as surfaces. A renderer match takes `target: 'surface' | 'region'`, defaulting to `surface`, plus `nodeKind` for region matches — so a container is swappable the same way a table is.

### Patch Changes

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

- Updated dependencies [19fb64b]
- Updated dependencies [845ae22]
- Updated dependencies [090e86a]
- Updated dependencies [763d1f8]
- Updated dependencies [9d23a9d]
- Updated dependencies [5774a22]
- Updated dependencies [52e383c]
- Updated dependencies [b914536]
- Updated dependencies [b4aa5f5]
- Updated dependencies [7622872]
- Updated dependencies [52e383c]
  - @khorum-oss/leyline-core@1.0.0

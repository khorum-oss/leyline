# @khorum-oss/leyline-agent

## 1.0.0

### Minor Changes

- 19fb64b: `@khorum-oss/leyline-agent`: the control plane as self-describing operations, with introspection that names every surface, its description, its current renderer, and which are on screen. `@khorum-oss/leyline-agent/mcp` serves them over MCP with the SDK as an optional peer, so the main entry point has no dependencies.

  An initiator may now carry an `attested` fact the transport fills and a caller cannot, with policy as the enforcement point.

  `@khorum-oss/leyline-core` fixes a hole in `apply` and `validate`: both read only the identifier from their argument now, so a caller cannot validate one change and commit another under the same proposal id.

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

- Updated dependencies [19fb64b]
- Updated dependencies [845ae22]
- Updated dependencies [090e86a]
- Updated dependencies [763d1f8]
- Updated dependencies [ca5c570]
- Updated dependencies [9d23a9d]
- Updated dependencies [5774a22]
- Updated dependencies [52e383c]
- Updated dependencies [b914536]
- Updated dependencies [b4aa5f5]
- Updated dependencies [7622872]
- Updated dependencies [a426e6d]
- Updated dependencies [52e383c]
  - @khorum-oss/leyline-core@1.0.0
  - @khorum-oss/leyline-schema@1.0.0

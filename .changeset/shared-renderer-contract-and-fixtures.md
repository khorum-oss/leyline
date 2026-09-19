---
'@khorum-oss/leyline-core': minor
'@khorum-oss/leyline-react': patch
'@khorum-oss/leyline-svelte': patch
'@khorum-oss/leyline-vanilla': patch
'@khorum-oss/leyline-agent': patch
---

`@khorum-oss/leyline-core`: the parts of the renderer contract that were identical in three
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

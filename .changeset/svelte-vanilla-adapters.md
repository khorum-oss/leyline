---
'@leyline/core': minor
'@leyline/svelte': minor
'@leyline/vanilla': minor
'@leyline/react': patch
---

Svelte and vanilla adapters: `WorkflowView` for Svelte, `mount` for plain DOM, both rendering the same document the React adapter does.

`@leyline/core` gains `buildRenderPlan`, which resolves an active tree into what each region and surface is drawn by. The walk, the registry questions, and the fallback selection were about to be written a third time, so they live in the core now and an adapter's whole job is turning a plan into its framework's output. The React adapter is rewritten on top of it with no test changes.

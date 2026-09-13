/**
 * `@leyline/svelte` — the Svelte adapter.
 *
 * Adapters stay thin (G5). This package bridges the core's store contract to
 * Svelte's, turns a render plan into slots, and mounts whichever component
 * claimed each region and surface. No workflow logic lives here.
 */

export { default as WorkflowView } from './WorkflowView.svelte';
export { FallbackSurface, FallbackRegion, FALLBACK_RENDERERS } from './fallback.js';
export { toSvelteStore, type SvelteReadable } from './store.js';
export { toRegionSlot } from './plan.js';
export type {
  SurfaceSlot,
  RegionSlot,
  SurfaceRendererProps,
  RegionRendererProps,
  SurfaceRenderer,
  RegionRenderer,
} from './types.js';

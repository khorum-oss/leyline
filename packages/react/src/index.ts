/**
 * `@leyline/react` — the React adapter.
 *
 * Adapters stay thin (G5). This package bridges the core's store contract to
 * React's own subscription primitive and hands each resolved surface and region
 * to whichever component claimed it. No workflow logic lives here; if it ever
 * needs some, that is a defect in the core rather than a cost of supporting
 * React.
 */

export { useLeylineStore } from './useLeylineStore.js';
export { WorkflowView, type WorkflowViewProps } from './WorkflowView.jsx';
export { FallbackSurface, FallbackRegion, FALLBACK_RENDERERS } from './fallback.jsx';
export type {
  SurfaceSlot,
  RegionSlot,
  SurfaceRendererProps,
  RegionRendererProps,
  SurfaceRenderer,
  RegionRenderer,
} from './types.js';

/**
 * `@khorum-oss/leyline-vanilla` — the direct DOM adapter.
 *
 * The reference implementation for plain JavaScript, and proof that the core is
 * genuinely headless (G5). It renders a workflow with no framework at all,
 * which is the only way to be sure nothing framework-shaped leaked into the
 * contract every other adapter depends on.
 */

export { mount, type MountOptions } from './mount.js';
export { fallbackSurface, fallbackRegion, FALLBACK_RENDERERS } from './fallback.js';
export { observe } from './observe.js';
export type {
  SurfaceSlot,
  RegionSlot,
  SurfaceRendererProps,
  RegionRendererProps,
  SurfaceRenderer,
  RegionRenderer,
} from './types.js';

import { regionIdentity, surfaceIdentity, type RegionPlan } from '@khorum-oss/leyline-core';
import { FallbackRegion, FallbackSurface } from './fallback.js';
import type {
  RegionRenderer,
  RegionSlot,
  SurfaceRenderer,
  SurfaceRendererProps,
  SurfaceSlot,
} from './types.js';

/**
 * Turns a render plan into slots a Svelte component can render.
 *
 * Svelte renders a dynamic component as `<Slot.component {...Slot.props} />`,
 * so a slot carries the component and its props rather than a render function.
 * That is the one real difference from the React adapter, and it is a
 * difference in how the framework mounts things rather than in what Leyline
 * decided.
 */
export function toRegionSlot(plan: RegionPlan): RegionSlot {
  const component = (plan.renderer?.component as RegionRenderer | undefined) ?? FallbackRegion;

  const surfaces: SurfaceSlot[] = plan.surfaces.map((entry) => {
    const props: SurfaceRendererProps = { surface: entry.surface };
    return {
      ...surfaceIdentity(entry),
      component: (entry.renderer?.component as SurfaceRenderer | undefined) ?? FallbackSurface,
      props,
    };
  });

  const regions: RegionSlot[] = plan.children.map((child) => toRegionSlot(child));

  return {
    ...regionIdentity(plan),
    component,
    props: { region: regionIdentity(plan), surfaces, regions },
  };
}

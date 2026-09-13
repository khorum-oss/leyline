import type { ActiveRegion, ResolvedSurface } from './contracts.js';
import type { Resolution } from './registry.js';

/**
 * The render plan: what every adapter needs before it can draw anything.
 *
 * Walking the active tree, asking the registry what claims each region and each
 * surface, and noticing when nothing does — none of that is framework work. The
 * React adapter did it first, and writing the Svelte and vanilla adapters made
 * it obvious that all three would do it identically. So it lives here, and an
 * adapter's whole job becomes turning a plan into its own framework's output
 * (G5, decision 0033).
 *
 * A plan is a snapshot of a decision, not a rendering. It holds identifiers,
 * resolved surfaces, and whatever opaque component each registry entry carries;
 * it never calls one.
 */

export interface Resolver {
  resolve(surface: ResolvedSurface): Resolution | undefined;
  resolveRegion(region: { readonly id: string; readonly kind: string }): Resolution | undefined;
}

export interface SurfacePlan {
  readonly surface: ResolvedSurface;
  /**
   * What claimed it, or undefined when nothing did.
   *
   * Undefined is normal operation: the adapter draws its fallback, and the core
   * has already reported `surface.unresolved` on the trace stream (AD5).
   */
  readonly renderer: Resolution | undefined;
}

export interface RegionPlan {
  readonly id: string;
  readonly kind: string;
  readonly description?: string;
  readonly renderer: Resolution | undefined;
  /** The region's own surfaces, in reading order. */
  readonly surfaces: readonly SurfacePlan[];
  /** Whatever is active beneath it, in reading order. */
  readonly children: readonly RegionPlan[];
}

/** Resolves an active tree into the plan an adapter renders. */
export function buildRenderPlan(resolver: Resolver, region: ActiveRegion): RegionPlan {
  return {
    id: region.id,
    kind: region.kind,
    ...(region.description !== undefined ? { description: region.description } : {}),
    renderer: resolver.resolveRegion({ id: region.id, kind: region.kind }),
    surfaces: region.surfaces.map((surface) => ({
      surface,
      renderer: resolver.resolve(surface),
    })),
    children: region.children.map((child) => buildRenderPlan(resolver, child)),
  };
}

/** Every region in a plan, depth-first in reading order, root included. */
export function* walkPlan(plan: RegionPlan): Generator<RegionPlan> {
  yield plan;
  for (const child of plan.children) yield* walkPlan(child);
}

// --- What a renderer receives ------------------------------------------------

/**
 * The renderer contract, with the one framework-shaped hole left open.
 *
 * All three adapters describe the same two things: a surface renderer receives
 * a resolved surface, and a region renderer receives its own surfaces and its
 * active children in reading order (decision 0030). The only difference is what
 * a slot *is* — React and the DOM adapter hand back a `render()` function,
 * Svelte hands back a component and its props, because that is how Svelte
 * mounts something dynamic.
 *
 * So the slot is the type parameter and the rest lives here. Three adapters
 * writing this out identically would be the core missing something (G5).
 */

/** Props every surface renderer receives, in every adapter. */
export interface SurfaceRendererProps {
  /** Guard already evaluated, data source already attached (AD6). */
  readonly surface: ResolvedSurface;
}

/** Props every region renderer receives, over whatever a slot is in this adapter. */
export interface RegionRendererPropsOf<TSurfaceSlot, TRegionSlot> {
  readonly region: Pick<ActiveRegion, 'id' | 'kind' | 'description'>;
  /** The region's own surfaces, in reading order. */
  readonly surfaces: readonly TSurfaceSlot[];
  /** The children currently active beneath it, in reading order. */
  readonly regions: readonly TRegionSlot[];
}

/**
 * The identity fields a region carries into a slot or a renderer's props.
 *
 * Every adapter copies these out of a plan node, twice — once for the region it
 * is drawing and once for each child slot — and every adapter had to write the
 * same conditional spread for `description`, because `exactOptionalPropertyTypes`
 * makes `description: undefined` a different thing from an absent key. That
 * constraint comes from this package, so the ready-made object should too.
 */
export function regionIdentity(
  plan: RegionPlan,
): Pick<ActiveRegion, 'id' | 'kind' | 'description'> {
  return {
    id: plan.id,
    kind: plan.kind,
    ...(plan.description !== undefined ? { description: plan.description } : {}),
  };
}

/** The identity fields a surface carries into a slot. */
export function surfaceIdentity(plan: SurfacePlan): { readonly id: string; readonly type: string } {
  return { id: plan.surface.id, type: plan.surface.type };
}

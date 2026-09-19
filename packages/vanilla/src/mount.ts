import {
  buildRenderPlan,
  regionIdentity,
  surfaceIdentity,
  type RegionPlan,
  type WorkflowInstance,
} from '@khorum-oss/leyline-core';
import { fallbackRegion, fallbackSurface } from './fallback.js';
import type { RegionRenderer, RegionSlot, SurfaceRenderer, SurfaceSlot } from './types.js';

/**
 * The direct DOM adapter, and the reference implementation for plain JavaScript.
 *
 * This package doubles as proof that the core is genuinely headless (G5).
 * Everything below turns a render plan into DOM nodes; anything it needed that
 * the core did not already provide would be a gap in the public contract rather
 * than a cost of supporting the DOM.
 */

function renderRegion(plan: RegionPlan): Node {
  const render = (plan.renderer?.component as RegionRenderer | undefined) ?? fallbackRegion;

  const surfaces: SurfaceSlot[] = plan.surfaces.map((entry) => ({
    ...surfaceIdentity(entry),
    render: () => {
      const draw = (entry.renderer?.component as SurfaceRenderer | undefined) ?? fallbackSurface;
      return draw({ surface: entry.surface });
    },
  }));

  const regions: RegionSlot[] = plan.children.map((child) => ({
    ...regionIdentity(child),
    render: () => renderRegion(child),
  }));

  return render({ region: regionIdentity(plan), surfaces, regions });
}

export interface MountOptions {
  /** Replaced on every published snapshot. Cleared on unmount. */
  readonly container: Element;
}

/**
 * Renders a workflow into a container and keeps it current.
 *
 * Each published snapshot replaces the container's contents outright. That is
 * the honest thing for a reference implementation: it has no diffing to get
 * subtly wrong, and it makes the cost of not having a framework visible rather
 * than hidden. An application that needs finer updates reaches for an adapter
 * whose framework already solved that.
 */
export function mount<TContext extends Record<string, unknown>>(
  workflow: WorkflowInstance<TContext>,
  options: MountOptions,
): () => void {
  const draw = (): void => {
    const plan = buildRenderPlan(workflow, workflow.getSnapshot().root);
    options.container.replaceChildren(renderRegion(plan));
  };

  draw();
  const unsubscribe = workflow.subscribe(draw);

  return () => {
    unsubscribe();
    options.container.replaceChildren();
  };
}

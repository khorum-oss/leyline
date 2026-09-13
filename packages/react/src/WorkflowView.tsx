import { Fragment, type ReactElement } from 'react';
import {
  buildRenderPlan,
  regionIdentity,
  surfaceIdentity,
  type RegionPlan,
  type WorkflowInstance,
} from '@leyline/core';
import { useLeylineStore } from './useLeylineStore.js';
import { FallbackRegion, FallbackSurface } from './fallback.jsx';
import type { RegionRenderer, RegionSlot, SurfaceRenderer, SurfaceSlot } from './types.js';

/**
 * The whole React surface of Leyline.
 *
 * The core resolves the active tree into a render plan — which region is drawn
 * by what, which surfaces each holds, what claimed them. Everything here turns
 * that plan into React, and nothing else. Writing the Svelte and vanilla
 * adapters is what showed the walk and the resolution belonged in the core
 * rather than three times over (decision 0033).
 */

function renderRegion(plan: RegionPlan): ReactElement {
  const Renderer = (plan.renderer?.component as RegionRenderer | undefined) ?? FallbackRegion;

  const surfaces: SurfaceSlot[] = plan.surfaces.map((entry) => ({
    ...surfaceIdentity(entry),
    render: () => {
      const Surface = (entry.renderer?.component as SurfaceRenderer | undefined) ?? FallbackSurface;
      return <Fragment key={entry.surface.id}>{Surface({ surface: entry.surface })}</Fragment>;
    },
  }));

  const regions: RegionSlot[] = plan.children.map((child) => ({
    ...regionIdentity(child),
    render: () => renderRegion(child),
  }));

  return (
    <Fragment key={plan.id}>
      {Renderer({ region: regionIdentity(plan), surfaces, regions })}
    </Fragment>
  );
}

export interface WorkflowViewProps<TContext extends Record<string, unknown>> {
  readonly workflow: WorkflowInstance<TContext>;
}

/**
 * Renders the active region tree of a workflow.
 *
 * Subscribes through `useSyncExternalStore`, so a snapshot published by the
 * core reaches React the way any external store does. Snapshots share structure
 * (AD4), which means an unchanged region is the same object and React skips it
 * without an equality function.
 */
export function WorkflowView<TContext extends Record<string, unknown>>({
  workflow,
}: WorkflowViewProps<TContext>): ReactElement {
  const snapshot = useLeylineStore(workflow);
  return renderRegion(buildRenderPlan(workflow, snapshot.root));
}

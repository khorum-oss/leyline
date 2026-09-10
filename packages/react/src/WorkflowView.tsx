import { Fragment, type ReactElement } from 'react';
import type { ActiveRegion, ResolvedSurface, WorkflowInstance } from '@leyline/core';
import { useLeylineStore } from './useLeylineStore.js';
import { FallbackRegion, FallbackSurface } from './fallback.jsx';
import type { RegionRenderer, RegionSlot, SurfaceRenderer, SurfaceSlot } from './types.js';

/**
 * The whole React surface of Leyline.
 *
 * Everything below resolves each active region and surface through the
 * registry and hands the result to whichever component claimed it. There is no
 * workflow logic here: guards are already evaluated, data sources already
 * attached, and reading order already decided, all before a snapshot arrives
 * (AD6). If this file ever needs to know what a guard is, that is a defect in
 * the core rather than a cost of supporting React (G5).
 */

interface Resolver {
  resolve(surface: ResolvedSurface): { component: unknown } | undefined;
  resolveRegion(region: { id: string; kind: string }): { component: unknown } | undefined;
}

function renderSurface(resolver: Resolver, surface: ResolvedSurface): ReactElement {
  // An unclaimed surface draws the built-in placeholder and the core reports it
  // on the trace stream. Rendering never throws (AD5).
  const claimed = resolver.resolve(surface)?.component as SurfaceRenderer | undefined;
  const Renderer = claimed ?? FallbackSurface;
  return <Fragment key={surface.id}>{Renderer({ surface })}</Fragment>;
}

function renderRegion(resolver: Resolver, region: ActiveRegion): ReactElement {
  const claimed = resolver.resolveRegion({ id: region.id, kind: region.kind })?.component as
    RegionRenderer | undefined;
  const Renderer = claimed ?? FallbackRegion;

  const surfaces: SurfaceSlot[] = region.surfaces.map((surface) => ({
    id: surface.id,
    type: surface.type,
    render: () => renderSurface(resolver, surface),
  }));

  const regions: RegionSlot[] = region.children.map((child) => ({
    id: child.id,
    kind: child.kind,
    ...(child.description !== undefined ? { description: child.description } : {}),
    render: () => renderRegion(resolver, child),
  }));

  return (
    <Fragment key={region.id}>
      {Renderer({
        region: {
          id: region.id,
          kind: region.kind,
          ...(region.description !== undefined ? { description: region.description } : {}),
        },
        surfaces,
        regions,
      })}
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
 * core reaches React the same way any external store does. Snapshots share
 * structure (AD4), which means an unchanged region is the same object and React
 * skips it without an equality function.
 */
export function WorkflowView<TContext extends Record<string, unknown>>({
  workflow,
}: WorkflowViewProps<TContext>): ReactElement {
  const snapshot = useLeylineStore(workflow);
  return renderRegion(workflow, snapshot.root);
}

import { Fragment } from 'react';
import type { RegionRenderer, SurfaceRenderer } from './types.js';

/**
 * What gets drawn when nothing in the registry claims something.
 *
 * A fallback is an ordinary catalogue entry claiming `*` at rank 0
 * (decision 0030), so it is inspectable through `describe()`, replaceable
 * through the control plane, and revertible — rather than a privileged
 * component the constitution would rule out.
 *
 * Neither carries styling. They exist so that an unclaimed surface is visible
 * and addressable rather than silently missing, and so that a document
 * containing surface types this build has never heard of still renders (AD8).
 */

export const FallbackSurface: SurfaceRenderer = ({ surface }) => (
  <div data-leyline-surface={surface.id} data-leyline-type={surface.type}>
    {surface.type}
  </div>
);

export const FallbackRegion: RegionRenderer = ({ region, surfaces, regions }) => (
  <div data-leyline-region={region.id} data-leyline-kind={region.kind}>
    {/* Calling render() rather than mounting it as a component: the function is
        rebuilt on every snapshot, so React would treat each one as a new type
        and remount the subtree, losing any state inside it. */}
    {surfaces.map((slot) => (
      <Fragment key={slot.id}>{slot.render()}</Fragment>
    ))}
    {regions.map((slot) => (
      <Fragment key={slot.id}>{slot.render()}</Fragment>
    ))}
  </div>
);

/** The catalogue entries and registrations an application gets for free. */
export const FALLBACK_RENDERERS = [
  {
    id: 'leyline.fallback.surface',
    description: 'Draws an unclaimed surface as a labelled placeholder.',
    claims: ['*'],
    component: FallbackSurface,
  },
  {
    id: 'leyline.fallback.region',
    description: 'Draws an unclaimed region as a plain container, children in reading order.',
    claims: ['*'],
    component: FallbackRegion,
  },
] as const;

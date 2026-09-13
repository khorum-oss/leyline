import type { RegionRenderer, SurfaceRenderer } from './types.js';

/**
 * What gets drawn when nothing in the registry claims something.
 *
 * Neither carries styling. They exist so an unclaimed surface is visible and
 * addressable rather than silently missing, and so a document containing
 * surface types this build has never heard of still renders (AD8).
 */

export const fallbackSurface: SurfaceRenderer = ({ surface }) => {
  const element = document.createElement('div');
  element.setAttribute('data-leyline-surface', surface.id);
  element.setAttribute('data-leyline-type', surface.type);
  element.textContent = surface.type;
  return element;
};

export const fallbackRegion: RegionRenderer = ({ region, surfaces, regions }) => {
  const element = document.createElement('div');
  element.setAttribute('data-leyline-region', region.id);
  element.setAttribute('data-leyline-kind', region.kind);
  for (const slot of surfaces) element.append(slot.render());
  for (const slot of regions) element.append(slot.render());
  return element;
};

/** The catalogue entries an application gets for free. */
export const FALLBACK_RENDERERS = [
  {
    id: 'leyline.fallback.surface',
    description: 'Draws an unclaimed surface as a labelled placeholder.',
    claims: ['*'],
    component: fallbackSurface,
  },
  {
    id: 'leyline.fallback.region',
    description: 'Draws an unclaimed region as a plain container, children in reading order.',
    claims: ['*'],
    component: fallbackRegion,
  },
] as const;

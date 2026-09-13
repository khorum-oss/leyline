import FallbackSurface from './FallbackSurface.svelte';
import FallbackRegion from './FallbackRegion.svelte';

export { FallbackSurface, FallbackRegion };

/** The catalogue entries an application gets for free. */
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

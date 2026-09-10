import type { ActiveRegion, ResolvedSurface } from '@leyline/core';
import type { ReactElement, ReactNode } from 'react';

/**
 * What a renderer receives (decision 0030).
 *
 * Two shapes, and both hand back a function rather than an element. A section
 * decides where its children go and calls `render()` when it has decided;
 * pre-rendering them here would be the adapter making an arrangement decision
 * that belongs to the component, which is the line decision 0019 draws.
 */

export interface SurfaceSlot {
  readonly id: string;
  readonly type: string;
  render: () => ReactElement;
}

export interface RegionSlot {
  readonly id: string;
  readonly kind: string;
  readonly description?: string;
  render: () => ReactElement;
}

/** Props every surface renderer receives. */
export interface SurfaceRendererProps {
  /** Guard already evaluated, data source already attached (AD6). */
  readonly surface: ResolvedSurface;
}

/** Props every region renderer receives. */
export interface RegionRendererProps {
  readonly region: Pick<ActiveRegion, 'id' | 'kind' | 'description'>;
  /** The region's own surfaces, in reading order. */
  readonly surfaces: readonly SurfaceSlot[];
  /** The children currently active beneath it, in reading order. */
  readonly regions: readonly RegionSlot[];
}

export type SurfaceRenderer = (props: SurfaceRendererProps) => ReactNode;
export type RegionRenderer = (props: RegionRendererProps) => ReactNode;

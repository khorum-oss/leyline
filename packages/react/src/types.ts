import type { RegionRendererPropsOf, SurfaceRendererProps } from '@leyline/core';
import type { ReactElement, ReactNode } from 'react';

/**
 * What a renderer receives (decision 0030).
 *
 * Two shapes, and both hand back a function rather than an element. A section
 * decides where its children go and calls `render()` when it has decided;
 * pre-rendering them here would be the adapter making an arrangement decision
 * that belongs to the component, which is the line decision 0019 draws.
 *
 * The props come from the core, which owns the shape all three adapters share.
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

export type { SurfaceRendererProps };
export type RegionRendererProps = RegionRendererPropsOf<SurfaceSlot, RegionSlot>;

export type SurfaceRenderer = (props: SurfaceRendererProps) => ReactNode;
export type RegionRenderer = (props: RegionRendererProps) => ReactNode;

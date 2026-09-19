import type { RegionRendererPropsOf, SurfaceRendererProps } from '@khorum-oss/leyline-core';

/**
 * What a renderer is, in plain DOM.
 *
 * The same contract the React adapter offers, with `Node` where React has an
 * element. The props themselves come from the core, which owns the shape all
 * three adapters share; a slot is the part that differs, and here it is a
 * function returning a node (decision 0030).
 */

export interface SurfaceSlot {
  readonly id: string;
  readonly type: string;
  render: () => Node;
}

export interface RegionSlot {
  readonly id: string;
  readonly kind: string;
  readonly description?: string;
  render: () => Node;
}

export type { SurfaceRendererProps };
export type RegionRendererProps = RegionRendererPropsOf<SurfaceSlot, RegionSlot>;

export type SurfaceRenderer = (props: SurfaceRendererProps) => Node;
export type RegionRenderer = (props: RegionRendererProps) => Node;

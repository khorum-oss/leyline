import type { ResolvedSurface } from '@leyline/core';

/**
 * What a renderer is, in plain DOM.
 *
 * The same shape the React adapter uses, with `Node` where React has an
 * element: a surface renderer receives the resolved surface, a region renderer
 * receives named slots and decides where each goes (decision 0030).
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

export interface SurfaceRendererProps {
  readonly surface: ResolvedSurface;
}

export interface RegionRendererProps {
  readonly region: { readonly id: string; readonly kind: string; readonly description?: string };
  readonly surfaces: readonly SurfaceSlot[];
  readonly regions: readonly RegionSlot[];
}

export type SurfaceRenderer = (props: SurfaceRendererProps) => Node;
export type RegionRenderer = (props: RegionRendererProps) => Node;

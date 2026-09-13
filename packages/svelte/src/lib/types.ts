import type { ResolvedSurface } from '@leyline/core';
import type { Component } from 'svelte';

/**
 * What a Svelte renderer is.
 *
 * A surface renderer is a component taking `{ surface }`. A region renderer is
 * a component taking named slots and deciding where each goes — the same
 * contract the React adapter offers, in Svelte's shape (decision 0030).
 */

export interface SurfaceSlot {
  readonly id: string;
  readonly type: string;
  /** The component to render, with the props it needs. */
  readonly component: Component<SurfaceRendererProps>;
  readonly props: SurfaceRendererProps;
}

export interface RegionSlot {
  readonly id: string;
  readonly kind: string;
  readonly description?: string;
  readonly component: Component<RegionRendererProps>;
  readonly props: RegionRendererProps;
}

export interface SurfaceRendererProps {
  readonly surface: ResolvedSurface;
}

export interface RegionRendererProps {
  readonly region: { readonly id: string; readonly kind: string; readonly description?: string };
  readonly surfaces: readonly SurfaceSlot[];
  readonly regions: readonly RegionSlot[];
}

export type SurfaceRenderer = Component<SurfaceRendererProps>;
export type RegionRenderer = Component<RegionRendererProps>;

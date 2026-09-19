import type { RegionRendererPropsOf, SurfaceRendererProps } from '@khorum-oss/leyline-core';
import type { Component } from 'svelte';

/**
 * What a Svelte renderer is.
 *
 * A surface renderer is a component taking `{ surface }`. A region renderer is
 * a component taking named slots and deciding where each goes — the same
 * contract the React adapter offers, in Svelte's shape (decision 0030).
 *
 * The slot is where Svelte differs from the other two: it carries the component
 * and the props to mount it with, rather than a function that draws it, because
 * that is how Svelte mounts something dynamic.
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

export type { SurfaceRendererProps };
export type RegionRendererProps = RegionRendererPropsOf<SurfaceSlot, RegionSlot>;

export type SurfaceRenderer = Component<SurfaceRendererProps>;
export type RegionRenderer = Component<RegionRendererProps>;

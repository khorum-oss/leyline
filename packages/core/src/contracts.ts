import type { InitiatorKind, NodeKind, SurfaceType } from '@leyline/schema';

/**
 * The public runtime contract (AD4, AD6, AD7).
 *
 * Stage 2 of the delivery sequence implements these. They live here first so
 * that adapters, the agent package, and the specs all target one shape.
 */

/** A surface with its guard already evaluated and its data source attached (AD6). */
export interface ResolvedSurface {
  readonly id: string;
  /** The node presenting it, so a control-plane change can address it. */
  readonly nodeId: string;
  readonly type: SurfaceType | (string & {});
  /** Human-readable description, carried through to agent introspection (§6). */
  readonly description?: string;
  readonly props: Readonly<Record<string, unknown>>;
  /** Whatever the surface's data source returned, already attached (AD6). */
  readonly data?: unknown;
  /**
   * Framework-neutral prop getters the adapter spreads onto native elements
   * (AD7). The core never ships components.
   */
  readonly getters: Readonly<Record<string, (...args: never[]) => Record<string, unknown>>>;
}

export type WorkflowStatus = 'idle' | 'running' | 'awaiting' | 'error' | 'done';

/**
 * One active node and everything active beneath it (decision 0019).
 *
 * A `section` running in `many` mode holds several active children at once, so
 * what is active is a tree rather than a single position. A `step` or a `hub`
 * is the same structure with no children — which is why adapters handle one
 * shape rather than two.
 *
 * `children` holds only what is currently active: every child of a `many`
 * section, and the one active child of a `one` section. In reading order,
 * which a viewer may have reordered.
 */
export interface ActiveRegion<TContext = Readonly<Record<string, unknown>>> {
  readonly id: string;
  readonly kind: NodeKind | (string & {});
  readonly description?: string;
  readonly surfaces: readonly ResolvedSurface[];
  readonly children: readonly ActiveRegion<TContext>[];
}

/** The immutable state adapters read. Structural sharing makes `===` a valid change check. */
export interface Snapshot<TContext = Readonly<Record<string, unknown>>> {
  /** The active tree, rooted at the workflow's entry node. */
  readonly root: ActiveRegion<TContext>;
  readonly context: TContext;
  readonly status: WorkflowStatus;
}

/** Walks an active tree depth-first in reading order, root included. */
export function* walkRegions<TContext>(
  region: ActiveRegion<TContext>,
): Generator<ActiveRegion<TContext>> {
  yield region;
  for (const child of region.children) yield* walkRegions(child);
}

/** Every resolved surface in the active tree, in reading order. */
export function activeSurfaces<TContext>(
  region: ActiveRegion<TContext>,
): readonly ResolvedSurface[] {
  return [...walkRegions(region)].flatMap((current) => current.surfaces);
}

export interface WorkflowEvent {
  readonly type: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

/** The subscription contract every framework adapter bridges to native reactivity. */
export interface Store<TSnapshot> {
  getSnapshot(): TSnapshot;
  subscribe(listener: () => void): () => void;
  send(event: WorkflowEvent): void;
}

/** Who a change is attributed to. Self-asserted and advisory in v1 (OQ8). */
export interface Initiator {
  readonly kind: InitiatorKind;
  readonly label?: string;
}

/** Implementations for the guards, services, and data sources a schema requires (AD2). */
export interface CapabilityBundle {
  readonly guards?: Readonly<Record<string, (context: never) => boolean>>;
  readonly services?: Readonly<Record<string, (input: never) => Promise<unknown>>>;
  readonly dataSources?: Readonly<Record<string, (input: never) => unknown>>;
}

/**
 * Development mode may default to permissive; production denies agent
 * initiators when no policy is configured. The distinction is explicit at
 * construction time, never inferred (brief §8, I6).
 */
export type RuntimeMode = 'development' | 'production';

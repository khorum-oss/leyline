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
  readonly type: SurfaceType | (string & {});
  /** Human-readable description, carried through to agent introspection (§6). */
  readonly description?: string;
  readonly props: Readonly<Record<string, unknown>>;
  /**
   * Framework-neutral prop getters the adapter spreads onto native elements
   * (AD7). The core never ships components.
   */
  readonly getters: Readonly<Record<string, (...args: never[]) => Record<string, unknown>>>;
}

export type WorkflowStatus = 'idle' | 'running' | 'awaiting' | 'error' | 'done';

/** The immutable state adapters read. Structural sharing makes `===` a valid change check. */
export interface Snapshot<TContext = Readonly<Record<string, unknown>>> {
  readonly node: { readonly id: string; readonly kind: NodeKind | (string & {}) };
  readonly context: TContext;
  readonly surfaces: readonly ResolvedSurface[];
  readonly status: WorkflowStatus;
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

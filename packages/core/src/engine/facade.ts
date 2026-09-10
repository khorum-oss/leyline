import type { WorkflowEvent, WorkflowStatus } from '../contracts.js';

/**
 * The internal statechart facade (AD3).
 *
 * XState runs behind this interface, and this directory is the only place in
 * the repository permitted to name it — enforced by a lint rule and by the CI
 * boundary check. The public API and the schema never expose XState types or
 * concepts, which keeps the option of replacing it with a smaller purpose-built
 * interpreter later.
 *
 * The facade deals in node identifiers and context. It knows nothing about
 * surfaces, registries, or renderers: turning an active tree of identifiers
 * into resolved surfaces belongs to the layer above, where it can be tested
 * without an interpreter at all.
 */

/** Which nodes are active, and what is active beneath them. */
export interface ActiveNodes {
  readonly id: string;
  readonly children: readonly ActiveNodes[];
}

export interface EngineInstance<TContext> {
  start(): void;
  stop(): void;
  send(event: WorkflowEvent): void;
  getActive(): ActiveNodes;
  getContext(): TContext;
  getStatus(): WorkflowStatus;
  /**
   * The interpreter's own position, opaque to everything outside the engine.
   * A rebuild hands it back so a graph-level change does not send a viewer to
   * the entry node (decision 0025).
   */
  getPosition(): unknown;
  /** Notifies on every published change. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** What the engine reports as it runs, so the layer above can trace it. */
export interface EngineObserver {
  onTransition(from: readonly string[], to: readonly string[], event: WorkflowEvent): void;
  onGuard(name: string, result: boolean): void;
  guardTracingEnabled(): boolean;
  onServiceInvoked(name: string, nodeId: string): void;
  onServiceSettled(name: string, nodeId: string, outcome: 'done' | 'error'): void;
}

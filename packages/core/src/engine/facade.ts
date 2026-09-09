/**
 * The internal statechart facade (AD3).
 *
 * XState runs the interpreter behind this interface. The public API and the
 * schema never expose XState types or concepts, which keeps the option of
 * replacing it with a smaller purpose-built interpreter later. This directory
 * is the only place in the repository permitted to name XState — the lint
 * configuration enforces that.
 */

import type { Snapshot, WorkflowEvent } from '../contracts.js';

export interface EngineInstance<TContext> {
  start(): void;
  stop(): void;
  send(event: WorkflowEvent): void;
  getSnapshot(): Snapshot<TContext>;
  subscribe(listener: (snapshot: Snapshot<TContext>) => void): () => void;
}

/**
 * Stage 2 implements this over XState. Nothing outside this directory imports
 * the engine; everything else depends on `EngineInstance` alone.
 */
export interface EngineFactory {
  create<TContext>(input: {
    readonly document: unknown;
    readonly capabilities: unknown;
    readonly onTrace: (kind: string, data: Record<string, unknown>) => void;
  }): EngineInstance<TContext>;
}

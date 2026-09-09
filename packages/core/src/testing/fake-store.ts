import type { Store, WorkflowEvent } from '../contracts.js';

/**
 * A store satisfying the core contract without running a workflow.
 *
 * Adapters are tested against this so that a failing adapter test means the
 * bridge is wrong, never that the interpreter changed. It lives in the core
 * because the core owns the contract every adapter implements.
 */
export interface FakeStore<T> extends Store<T> {
  /** Publishes a new snapshot and notifies every listener. */
  push(snapshot: T): void;
  /** Events the adapter sent, in order. */
  readonly sent: readonly WorkflowEvent[];
  readonly listenerCount: () => number;
}

export function createFakeStore<T>(initial: T): FakeStore<T> {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const sent: WorkflowEvent[] = [];

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    send(event) {
      sent.push(event);
    },
    push(next) {
      snapshot = next;
      for (const listener of [...listeners]) listener();
    },
    sent,
    listenerCount: () => listeners.size,
  };
}

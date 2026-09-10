import { useSyncExternalStore } from 'react';
import type { Store } from '@leyline/core';

/**
 * The reactivity bridge: the core's store contract, as a React hook.
 */

/**
 * Subscribes a component to a Leyline store.
 *
 * Snapshots are immutable with structural sharing (AD4), so React's identity
 * comparison is a valid change check and no equality function is needed.
 */
export function useLeylineStore<TSnapshot>(store: Store<TSnapshot>): TSnapshot {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
}

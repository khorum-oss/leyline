import { useSyncExternalStore } from 'react';
import type { Store } from '@leyline/core';

/**
 * `@leyline/react` — the React reactivity bridge.
 *
 * Adapters stay thin (G5). Everything below bridges the core's store contract
 * to React's own subscription primitive; no workflow logic lives here. If this
 * package grows meaningful logic, treat it as a defect in the core.
 *
 * Delivery stage 3 adds the ranked renderer registry and `WorkflowView`, and
 * proves the §2 scenario end to end.
 */

export const packageStatus = {
  package: '@leyline/react',
  deliveryStage: 3,
  status: 'in-progress',
} as const;

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

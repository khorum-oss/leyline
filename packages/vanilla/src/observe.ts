import type { Store } from '@khorum-oss/leyline-core';

/**
 * Runs `render` with the current snapshot and again on every change, returning
 * an unsubscribe function.
 *
 * The smallest possible bridge over the store contract, and the yardstick every
 * other adapter is measured against.
 */
export function observe<TSnapshot>(
  store: Store<TSnapshot>,
  render: (snapshot: TSnapshot) => void,
): () => void {
  render(store.getSnapshot());
  return store.subscribe(() => render(store.getSnapshot()));
}

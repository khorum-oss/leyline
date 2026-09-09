import type { Store } from '@leyline/core';

/**
 * `@leyline/vanilla` — the direct DOM adapter.
 *
 * This package doubles as the reference implementation for plain JavaScript and
 * as proof that the core is genuinely headless (G5). Anything it cannot do
 * without reaching into core internals marks a gap in the public contract.
 *
 * Delivery stage 6 adds DOM mounting and the renderer registry.
 */

export const packageStatus = {
  package: '@leyline/vanilla',
  deliveryStage: 6,
  status: 'planned',
} as const;

/**
 * Runs `render` with the current snapshot and again on every change, returning
 * an unsubscribe function. The smallest possible bridge over the store
 * contract, and the yardstick every other adapter is measured against.
 */
export function observe<TSnapshot>(
  store: Store<TSnapshot>,
  render: (snapshot: TSnapshot) => void,
): () => void {
  render(store.getSnapshot());
  return store.subscribe(() => render(store.getSnapshot()));
}

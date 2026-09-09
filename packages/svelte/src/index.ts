import type { Store } from '@leyline/core';

/**
 * `@leyline/svelte` — the Svelte store bridge.
 *
 * Svelte's store contract is a plain `subscribe` function, so this adapter
 * needs no Svelte import at all — which is the point: the core stayed headless
 * (G5). Delivery stage 6 adds the component and re-runs the §2 agent scenario
 * against a SvelteKit application with no change to `@leyline/agent`.
 */

export const packageStatus = {
  package: '@leyline/svelte',
  deliveryStage: 6,
  status: 'planned',
} as const;

export interface SvelteReadable<T> {
  subscribe(run: (value: T) => void): () => void;
}

/** Presents a Leyline store as a Svelte readable, so `$store` works directly. */
export function toSvelteStore<TSnapshot>(store: Store<TSnapshot>): SvelteReadable<TSnapshot> {
  return {
    subscribe(run) {
      run(store.getSnapshot());
      return store.subscribe(() => run(store.getSnapshot()));
    },
  };
}

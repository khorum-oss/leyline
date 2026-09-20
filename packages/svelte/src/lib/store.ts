import type { Store } from '@khorum-oss/leyline-core';

/**
 * The Svelte store bridge.
 *
 * Svelte's store contract is a plain `subscribe` function, so this needs no
 * import from Svelte at all — which is the point: the core stayed headless
 * enough that bridging it is four lines (G5).
 */

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

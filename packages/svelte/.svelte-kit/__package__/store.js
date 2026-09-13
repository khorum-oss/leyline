/** Presents a Leyline store as a Svelte readable, so `$store` works directly. */
export function toSvelteStore(store) {
    return {
        subscribe(run) {
            run(store.getSnapshot());
            return store.subscribe(() => run(store.getSnapshot()));
        },
    };
}

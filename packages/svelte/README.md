# @leyline/svelte

The Svelte store bridge.

Svelte's store contract is a plain `subscribe` function, so this adapter imports
nothing from Svelte at all — which is the point. `toSvelteStore` presents a
Leyline instance as a readable, so `$store` works directly.

See the [glossary](../../docs/glossary.md#the-runtime) for **store contract**
and **snapshot**.

```svelte
<script>
  const snapshot = toSvelteStore(workflow);
</script>

{#each $snapshot.surfaces as surface (surface.id)}
  <!-- rendered through the registry -->
{/each}
```

## Next — delivery stage 6

The component and the registry bridge. The stage re-runs the brief's §2 agent
scenario against a SvelteKit application with no change to `@leyline/agent` —
the genuine test of whether the core stayed headless.

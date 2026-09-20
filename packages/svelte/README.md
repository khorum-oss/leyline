# @khorum-oss/leyline-svelte

The Svelte adapter.

Adapters stay thin (G5). The core resolves the active tree into a
[render plan](../../docs/glossary.md#render-plan) — what claims each region and
surface — and this package mounts whichever component claimed each one. No
workflow logic lives here.

See the [glossary](../../docs/glossary.md#the-runtime) for **store contract**,
**snapshot**, **slot**, and **region renderer**.

## Rendering a workflow

```svelte
<script lang="ts">
  import { WorkflowView } from '@khorum-oss/leyline-svelte';
  const { workflow } = $props();
</script>

<WorkflowView {workflow} />
```

## Writing a renderer

A surface renderer takes the surface, with its guard already evaluated and its
data source already attached:

```svelte
<script lang="ts">
  import type { SurfaceRendererProps } from '@khorum-oss/leyline-svelte';
  const { surface }: SurfaceRendererProps = $props();
  const rows = $derived((surface.data ?? []) as Action[]);
</script>

<table>
  <tbody
    >{#each rows as row (row.id)}<tr><td>{row.label}</td></tr>{/each}</tbody
  >
</table>
```

A region renderer takes named slots and decides where each goes:

```svelte
<script lang="ts">
  import type { RegionRendererProps } from '@khorum-oss/leyline-svelte';
  const { surfaces, regions }: RegionRendererProps = $props();
  const aside = $derived(regions.find((slot) => slot.id === 'navigation'));
  const rest = $derived(regions.filter((slot) => slot.id !== 'navigation'));
</script>

<div class="columns">
  <aside>
    {#if aside}<aside.component {...aside.props} />{/if}
  </aside>
  <main>
    {#each surfaces as slot (slot.id)}<slot.component {...slot.props} />{/each}
    {#each rest as slot (slot.id)}<slot.component {...slot.props} />{/each}
  </main>
</div>
```

A Svelte slot carries the component and its props rather than a render function,
because that is how Svelte mounts a dynamic component. It is the only real
difference from the React adapter, and it is a difference in how the framework
works rather than in anything Leyline decided.

## The store bridge

`toSvelteStore` presents a Leyline instance as a Svelte readable, so `$store`
works directly. It imports nothing from Svelte — the store contract is a plain
`subscribe` function, which is a small piece of evidence that the core stayed
headless.

## Building

This package is built with `@sveltejs/package` rather than tsup, because tsup
cannot compile `.svelte`. It is the only package in the repository that needs a
different build tool, and the reason is entirely Svelte's file format.

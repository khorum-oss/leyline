# The §2 scenario, in Svelte

The same document the [React example](../react-workspace) renders, bound to the
same capabilities, driven through the same control plane.

```bash
pnpm --filter @leyline-examples/svelte-workspace dev
```

The buttons along the top reach the control plane the way an agent would — swap
the actions table for a card grid, hide the metrics panel behind a guard, revert.
Each one is a proposal, a validation, and an apply; the trace stream underneath
shows what happened.

## What is actually different from the React version

Open `src/App.svelte` next to `../react-workspace/src/App.tsx`. The differences
are `$state` instead of `useState` and `$effect` instead of `useEffect`. That is
the claim the second adapter exists to test.

One difference is not cosmetic. A region renderer's slots carry a **component and
its props** rather than a `render()` function:

```svelte
{#each surfaces as slot (slot.id)}
  <slot.component {...slot.props} />
{/each}
```

That is how Svelte mounts something dynamic. It is a fact about Svelte, not a
decision Leyline made — and it is why the renderer contract leaves the slot as
the one framework-shaped hole while the core owns the rest.

## What this is not

It is not part of the library. Nothing under `packages/` refers to it, it is
`private` so it is never published, and the release pipeline ignores it. CI
builds and typechecks it so it cannot rot quietly.

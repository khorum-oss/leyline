# The §2 scenario, with no framework

The same document the [React](../react-workspace) and [Svelte](../svelte-workspace)
examples render — straight into the DOM, with no framework underneath.

```bash
pnpm --filter @leyline-examples/vanilla-workspace dev
```

## Why it is worth having

It is the reference implementation, and it is also the yardstick. A renderer here
hands back a `Node`:

```ts
export const ActionsTable: SurfaceRenderer = ({ surface }) => {
  const table = document.createElement('table');
  // …one row per action
  return table;
};
```

That is the entire contract. If bridging the core to a framework ever takes much
more than this example does without one, something belongs in the core and is not
there yet.

It also makes the cost of having no framework visible rather than hidden. Every
published snapshot replaces the container outright — no diffing to get subtly
wrong — and the twenty lines in `src/main.ts` that wire a `<select>` and three
buttons by hand are what React and Svelte were doing for you.

What it does _not_ cost is any Leyline feature. The control plane, the guards,
the trace stream, and the renderer catalogue all work exactly as they do in the
other two.

## What this is not

It is not part of the library. Nothing under `packages/` refers to it, it is
`private` so it is never published, and the release pipeline ignores it. CI
builds and typechecks it so it cannot rot quietly.

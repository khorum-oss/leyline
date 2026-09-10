# The §2 scenario, in React

The brief's motivating scenario as a running application: create a workspace,
settle billing when the tier calls for it, arrive at a hub whose actions table,
metrics panel, and links are drawn by registered renderers.

```bash
pnpm --filter @leyline-examples/react-workspace dev
```

The buttons along the top drive the control plane the same way an agent would —
swap the actions table for a card grid, hide the metrics panel, reset. Each one
is a proposal, a validation, and an apply; the trace stream underneath shows
what happened.

## What this is not

It is not part of the library. Nothing under `packages/` refers to it, it is
`private` so it is never published, and the release pipeline ignores it. CI
builds it so it cannot rot quietly, and that is the whole of its relationship
with the rest of the repository.

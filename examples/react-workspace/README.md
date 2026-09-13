# The §2 scenario, in React

The brief's motivating scenario as a running application: create a workspace,
settle billing when the tier calls for it, arrive at a hub whose actions table,
metrics panel, and links are drawn by registered renderers.

```bash
pnpm install
pnpm --filter @leyline-examples/react-workspace dev
```

`dev` resolves `@leyline/*` to the workspace sources, so a fresh clone needs no
build first and an edit under `packages/` reaches the page immediately. Building
the example is the other way round — it resolves through each package's
published `exports`, so `pnpm build` at the root has to come first:

```bash
pnpm build
pnpm --filter @leyline-examples/react-workspace build
```

## Let a CLI agent change it while you watch

```bash
pnpm --filter @leyline-examples/react-workspace live
```

That starts the page and a relay, and opens a browser. Then, in another
terminal:

```bash
claude
> swap the actions table for something easier to scan
> hide the metrics panel unless the workspace is paying
> put the table back
```

The page redraws as the model applies each change. Nothing in the page knows a
terminal was involved: the agent reaches the same control plane the buttons
reach and meets the same policy, which is the whole claim.

### Why there is a relay at all

The workflow lives in the **browser**, because that is where the components are.
A render plan resolves each surface to an actual component function, so it is
not a thing that can be serialised and handed to another process — which settles
the topology. Whoever wants to change the UI has to reach the page.

```
claude ──stdio──▶ mcp-bridge.ts ──POST──▶ relay.mjs
                       ▲                      │ SSE
                       └───── result ◀── POST ─┘ browser
                                            (workflow + surface + policy)
```

Neither [`relay.mjs`](relay.mjs) nor the page's half of the bridge holds a
workflow. The relay carries tool calls down and results back and imports nothing
from Leyline at all; [`mcp-bridge.ts`](mcp-bridge.ts) hands `serveOverMcp` a
stand-in surface whose `handle` posts to the relay, so the operation runs
against the workflow the browser is drawing and the result is that workflow's.

The policy lives in [`src/agent-bridge.ts`](src/agent-bridge.ts), in the page.
The relay carries bytes; it is not trusted to say who may do what.

Two things behave the way the rest of the library does. With no page open a call
comes back as a **refusal** — `relay.no-page`, carrying a suggestion — rather
than hanging on a socket nobody is reading. And a tier change builds a new
workflow, so the bridge retires the old subscription with it rather than leaving
two surfaces answering the same relay.

`pnpm dev` is unchanged and needs none of this.

The buttons along the top drive the control plane the same way an agent would —
swap the actions table for a card grid, hide the metrics panel, reset. Each one
is a proposal, a validation, and an apply; the trace stream underneath shows
what happened.

## What this is not

It is not part of the library. Nothing under `packages/` refers to it, it is
`private` so it is never published, and the release pipeline ignores it. CI
builds it so it cannot rot quietly, and that is the whole of its relationship
with the rest of the repository.

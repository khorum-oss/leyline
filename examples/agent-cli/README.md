# The §2 scenario, driven by an agent

Brief §2 items 6 and 7 — _swap the actions table for a card grid_, _hide the
metrics panel for free tiers_ — carried out by an agent with **no access to
application source**.

Three ways to run it. All three call `surface.handle(name, input)` and nothing
else, which is the claim worth testing: if a scripted run and a language model
needed different code paths, `@leyline/agent` would have failed at its one job.

## Scripted — no API key, no network

```bash
pnpm --filter @leyline-examples/agent-cli demo
```

This is what CI runs. It walks through discovery, two refusals, both changes, a
revert, and the audit trail, printing what is on screen after each step.

**The two refusals are the interesting part**, and they fail for different
reasons:

| the change                                        | refused by         | rule                      |
| ------------------------------------------------- | ------------------ | ------------------------- |
| naming a renderer the application never published | the catalogue (I3) | `renderer.undiscoverable` |
| a change kind this deployment does not permit     | the policy (I6)    | `policy.denied`           |

Both come back as **data**, not as thrown errors, carrying the rule that was
violated and — for the first — a suggestion naming every renderer that would
have been legal. That distinction is deliberate: the call worked, the change was
rejected, and conflating the two tells an agent to retry the call rather than
reconsider the change.

## Interactive — still no API key

```bash
pnpm --filter @leyline-examples/agent-cli repl
```

You, at the other end of the agent surface. `tools` lists the operations,
`schema <tool>` prints one's JSON Schema, `view` shows what is on screen, and
anything else runs an operation:

```
leyline ❯ leyline_describe
leyline ❯ leyline_propose {"change":{"kind":"renderer.register","registry":"default",
                            "renderer":"CardGrid","match":{"surfaceId":"actions"},"rank":80}}
leyline ❯ leyline_validate {"id":"pr_…"}
leyline ❯ leyline_apply {"id":"pr_…"}
```

Typing tool calls by hand is the cheapest way to see that an agent gets no
special channel — and the cheapest way to try something and watch the control
plane refuse it.

## With a real model

```bash
export ANTHROPIC_API_KEY=sk-ant-…
pnpm --filter @leyline-examples/agent-cli chat
```

Then ask for things in English:

```
you ❯ swap the actions table for something easier to scan
you ❯ hide the metrics panel unless the workspace is paying
you ❯ actually, put the table back
```

The whole adapter is one `map` in `src/chat.ts`:

```ts
const tools: Anthropic.Tool[] = surface.tools().map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
}));
```

`surface.tools()` already carries the **published JSON Schema** for every
operation, so it is passed through verbatim rather than translated. What the
model sees is the contract, not a description of it.

It is a manual tool-use loop rather than the SDK's tool runner, because the loop
is the thing worth reading here — and because it keeps the example off a beta
API. `@anthropic-ai/sdk` is a `devDependency` and is imported lazily, so `demo`
and `repl` never load it.

For MCP instead of a direct API loop, see
[`@leyline/agent/mcp`](../../packages/agent/README.md#mcp) — same surface, same
`tools()`, about forty lines.

## What the agent cannot do

The policy in `src/session.ts` is this deployment's decision, and it is short:

```ts
export const policy: Policy = forInitiator(
  'agent',
  allowKinds('renderer.register', 'renderer.unregister', 'surface.attach-guard', …),
);
```

Notice what is _not_ in it: nothing enumerates renderers. An agent may name only
what the application published to the catalogue, and that is enforced by the
control plane rather than by the policy. Nothing the agent sends can introduce a
guard, a service, a data source, or a component — the schema is inert, so the
worst a hostile initiator can do is name things the application already trusts.

Production mode with no policy refuses agent initiators outright, so a deployment
that wants agents has to say what they may do. See
[`docs/guides/agents.md`](../../docs/guides/agents.md).

## What this is not

It is not part of the library. Nothing under `packages/` refers to it, it is
`private` so it is never published, and the release pipeline ignores it. CI runs
the scripted mode so it cannot rot quietly.

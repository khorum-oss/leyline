# The §2 scenario, driven by an agent

Brief §2 items 6 and 7 — _swap the actions table for a card grid_, _hide the
metrics panel for free tiers_ — carried out by an agent with **no access to
application source**.

Four ways to run it. All four call `surface.handle(name, input)` and nothing
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

## With a local CLI — a real model, still no API key

If you already have `claude` or `codex` installed, they are already signed in
and they already speak MCP. Point one at this server and a real model drives the
control plane without an API key or a billing account:

```bash
claude
```

That is the whole of it. [`.mcp.json`](../../.mcp.json) at the repository root
names the server, so the `leyline_*` tools are there the moment Claude Code
starts anywhere in this repo. Then ask in English:

```
> swap the actions table for something easier to scan
> hide the metrics panel unless the workspace is paying
> actually, put the table back
```

For codex, the equivalent lives in `~/.codex/config.toml`, which is global
rather than project-local and so needs to be told where the repository is:

```toml
[mcp_servers.leyline]
command = "pnpm"
args = ["--silent", "--filter", "@leyline-examples/agent-cli", "mcp"]
cwd = "/path/to/leyline"
```

To run the server by hand — or to wire up an editor that wants a command rather
than a config file:

```bash
pnpm --filter @leyline-examples/agent-cli mcp
```

The adapter is [`serveOverMcp`](../../packages/agent/src/mcp.ts) and this mode
adds no second one. It publishes the operations with their JSON Schema passed
through verbatim, which leaves [`src/mcp.ts`](src/mcp.ts) responsible for a
transport and nothing else — the point being that a second tool-calling format
cost the library no second surface.

Two things are worth knowing if you change this mode:

**Under stdio, stdout _is_ the protocol.** One `console.log` lands in the middle
of a JSON-RPC frame and the client disconnects with a parse error that names
nothing useful. Every human-facing byte in this mode goes to stderr, which both
CLIs surface as server logs.

**A refusal still arrives as data.** `isError` stays false and the rule that was
violated comes back in the result, exactly as it does in the other three modes.
The call worked; the change was rejected. An agent that reads it reconsiders the
change rather than retrying the call.

## With a real model

If you would rather read a tool-use loop than configure a CLI, this mode is the
one to read — it is the same surface again, driven directly:

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
the scripted mode, and `pnpm smoke` — which starts the MCP server, talks to it
over a real pipe, and checks that a refusal survives the transport as data — so
neither can rot quietly.

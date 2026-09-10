# @leyline/agent

The control plane, packaged for machine consumers.

This package adds no capability the control plane lacks (G9). It packages
introspection that reads like documentation, operation descriptors carrying the
published JSON Schema, structured errors an agent can act on, and the identity
boundary between an untrusted caller and the control plane.

See the [glossary](../../docs/glossary.md#the-control-plane) for **proposal**,
**change record**, **policy**, **initiator**, **attestation**, and **agent
surface**.

## Two calls to swap a table for a card grid

```ts
const surface = createAgentSurface(workflow, {
  initiator: { kind: 'agent', label: 'card-grid-swap' },
});

await surface.handle('leyline_describe');
// → the actions surface, its description, its current renderer, and the
//   renderers this application published

await surface.handle('leyline_propose', {
  change: {
    kind: 'renderer.register',
    registry: 'default',
    renderer: 'CardGrid',
    match: { surfaceId: 'actions' },
    rank: 80,
  },
});
```

Then `leyline_validate`, `leyline_apply`, and — if it was a mistake —
`leyline_revert`.

## Operations

| Tool               | Writes  | What it does                                                                                                                                             |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leyline_describe` | no      | The workflow, its surfaces with descriptions and current renderers, which are on screen now, the published renderer catalogue, the capabilities required |
| `leyline_propose`  | no      | Describes a change and puts it to policy. Nothing is committed                                                                                           |
| `leyline_validate` | no      | Structured issues. Safe as a dry run                                                                                                                     |
| `leyline_apply`    | **yes** | Commits a validated proposal                                                                                                                             |
| `leyline_revert`   | **yes** | Undoes an applied change by record id                                                                                                                    |
| `leyline_log`      | no      | The ordered record of applied changes                                                                                                                    |
| `leyline_pending`  | no      | Proposals policy held for confirmation                                                                                                                   |
| `leyline_trace`    | no      | Recent trace events, to confirm an applied change did what was expected                                                                                  |

Two omissions are deliberate. **Confirm and cancel are absent**: a policy asking
for confirmation is asking somebody other than the initiator to look, and an
agent that could confirm its own proposal would make that answer meaningless.
**Nothing accepts an initiator**: the surface speaks for one identity, fixed at
construction.

## Identity

```ts
const surface = createAgentSurface(workflow, {
  initiator: { kind: 'agent', label: 'reviewer-bot' },
  attestation: { subject: 'svc_reviewer', via: 'mtls' },
});
```

The label is advisory — self-asserted, recorded as-is. The attestation is what
_your_ transport authenticated, and a caller cannot supply one: anything sent
under `attested` in a tool call is discarded. Requiring it is a policy, because
whether to require it depends on the deployment
([decision 0031](../../docs/decisions/0031-initiator-trust.md)).

## MCP

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { serveOverMcp } from '@leyline/agent/mcp';

const server = new Server({ name: 'leyline', version: '1' }, { capabilities: { tools: {} } });
serveOverMcp(server, surface, {
  listToolsRequestSchema: ListToolsRequestSchema,
  callToolRequestSchema: CallToolRequestSchema,
});
```

The adapter lists the surface's operations as MCP tools, passing the published
JSON Schema through verbatim — what an agent sees is the contract, not a
translation of it — and forwards each call.

Transport and auth stay yours. The SDK is an **optional** peer dependency and
the main entry point has no dependencies at all, so anyone targeting a different
tool-calling format uses `surface.tools()` directly and never installs it.

A refused change comes back as a normal result with `isError: false`. The call
worked; the change was rejected, for a reason the agent can read and act on.
Those are different things, and conflating them tells an agent to retry the
call rather than reconsider the change.

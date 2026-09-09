# @leyline/agent

The control plane, packaged for machine consumers.

This package adds no capability the control plane lacks (G9). It packages
introspection that reads like documentation, operation descriptors that map onto
tool and MCP definitions, structured errors an agent can act on, and idempotent,
replayable proposals.

See the [glossary](../../docs/glossary.md#the-control-plane) for **proposal**,
**change record**, **policy**, **initiator**, and **operation descriptor**.

The goal it exists to serve: "swap the actions table for a card grid" becomes a
two-call task — `describe()` to find the surface and its renderer,
`apply(registerRenderer(...))` to override it at a higher rank. Reverting takes
one more call.

## Next — delivery stage 4

Introspection, operation descriptors, and the MCP server adapter. The stage
lands before the second and third adapters on purpose: a control plane that
turns out to need framework knowledge is a core design defect worth finding
early.

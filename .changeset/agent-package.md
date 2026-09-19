---
'@khorum-oss/leyline-agent': minor
'@khorum-oss/leyline-core': patch
'@khorum-oss/leyline-schema': minor
---

`@khorum-oss/leyline-agent`: the control plane as self-describing operations, with introspection that names every surface, its description, its current renderer, and which are on screen. `@khorum-oss/leyline-agent/mcp` serves them over MCP with the SDK as an optional peer, so the main entry point has no dependencies.

An initiator may now carry an `attested` fact the transport fills and a caller cannot, with policy as the enforcement point.

`@khorum-oss/leyline-core` fixes a hole in `apply` and `validate`: both read only the identifier from their argument now, so a caller cannot validate one change and commit another under the same proposal id.

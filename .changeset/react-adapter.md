---
'@leyline/react': minor
'@leyline/core': minor
'@leyline/schema': minor
---

The React adapter: `WorkflowView` resolves each active region and surface through the registry and hands it to whichever component claimed it, with built-in fallbacks so an unclaimed surface draws a placeholder rather than nothing.

Registries can now claim regions as well as surfaces. A renderer match takes `target: 'surface' | 'region'`, defaulting to `surface`, plus `nodeKind` for region matches — so a container is swappable the same way a table is.

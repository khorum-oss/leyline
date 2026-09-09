---
'@leyline/schema': minor
'@leyline/core': minor
---

Section nodes: a node kind that contains other nodes and says how they run together — `one` child at a time or `many` at once. Children are named rather than nested, so transition targets stay plain identifiers. Containment is validated as its own structure, and a transition may not land inside a section it does not belong to.

End users become a fourth initiator kind, with `section.reorder-children` and `section.move-child` expressing personalization as ordinary control-plane changes.

`Snapshot` now exposes an `ActiveRegion` tree rather than a single node, since a section running in `many` mode has several children active at once. `walkRegions` and `activeSurfaces` traverse it.

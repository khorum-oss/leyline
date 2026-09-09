# 0019. The `section` node kind

- **Status:** accepted
- **Date:** 2026-09-09

## Context

The v1 node kinds — `step` and `hub` — describe positions but not containment.
Real interfaces nest: a page holds a sidebar and a main panel that advance
independently; a panel holds a wizard that advances one screen at a time; an
input box moves through idle, editing, validating, and error while everything
around it carries on.

Expressing that with flat nodes means encoding containment in guards and naming
conventions, which is exactly the kind of knowledge Leyline exists to lift out
of components.

The obvious danger sits right next to the obvious solution. Brief §4 rules out
layout control: "a schema that can express `div with flex-direction row` has
become a worse HTML and has failed." A container construct is one careless field
away from that.

## Decision

A third node kind, `section`, that declares **containment and state topology,
never arrangement**.

```jsonc
{
  "id": "dashboard",
  "kind": "section",
  "mode": "many",
  "children": ["navigation", "workspace", "activity"],
  "surfaces": [{ "id": "page-heading", "type": "text" }],
}
```

Four rules make it carry its weight without crossing the line.

**Children are named, not nested.** `children` lists identifiers from the same
flat `nodes` array. Containment is a declaration; the tree is derived. A
transition target therefore stays a plain identifier with no path syntax, which
keeps I5 intact, keeps diffs small, and keeps the document a single list for an
agent to walk.

**Two modes, and only two.** `one` keeps exactly one child active; `many` keeps
every child active and advancing independently. Both map directly onto
statechart compound and parallel states, so the interpreter inherits semantics
that are already solved (AD3). Two words cover the whole range from a page to an
input box.

**Any node may be a child, including another section.** Depth is unbounded and
scale is irrelevant: page contains panel contains input, one construct
throughout.

**No layout fields, ever.** A section's renderer receives its active child
regions as named slots and decides the arrangement itself. A full page, an inner
panel, and an input box are the same schema resolved to different renderers.
`children` order is _reading_ order — a semantic sequence a renderer may honour,
the same thing source order means in HTML — never a position, a size, or a
direction.

**Transitions may not cross into a foreign section.** A transition reaches a
root node, a sibling, or an ancestor. Landing anywhere inside a section the
source does not belong to is rejected as `graph.cross-boundary-target`, with the
section itself suggested instead; entering a container means entering it at the
top. This is the one deliberate restriction against configurability, and it is
what keeps both the graph readable and the interpreter from becoming a research
project.

## Consequences

**The snapshot stops being one node.** With `mode: many`, several nodes are
active at once, so the snapshot exposes an active _tree_ — each region with its
own resolved surfaces — rooted at the entry node. A `step` is that same shape
with no children, so adapters handle one structure rather than two. This
supersedes the single-node sketch in brief §6 and refines AD4 and AD6.

Taking this decision before the interpreter exists made it cheap. Taking it
after stage 2 would have meant reshaping the contract every adapter reads.

**Reachability follows containment as well as transitions.** A child of a `many`
section is reached because the section runs it; the initial child of a `one`
section likewise, with its siblings reached through transitions. A node no
section holds and nothing targets is still an error.

**Renderer registries learn to claim regions**, not only surfaces — a modest
extension of AD5's ranked predicates, and the mechanism by which a viewer swaps
a one-column container for a two-column one.

**Everything here is additive** within schema v1: a new node kind and three
optional fields. Existing documents are unaffected, and a build that predates
this decision meets `section` as an unknown kind and falls back (AD8).

## Alternatives considered

**Nest child nodes inside the parent's JSON.** Rejected: transition targets then
need path syntax to address a nested node, which hands an initiator a structural
string to construct and contradicts I5. It also makes every diff of a deep tree
enormous.

**One mode only.** Exclusive containment alone cannot express a page whose
regions advance independently, which is the primary case. Parallel alone cannot
express a wizard or a multi-state input without reintroducing guards to fake it.

**Slots, areas, or a layout hint field.** Rejected as the worse-HTML failure
brief §4 names. Whatever a viewer wants to arrange, they arrange by choosing
among renderers the application made discoverable and by reordering children —
never by writing arrangement into the document.

**Explicit events between regions.** Deferred. Regions coordinate through shared
context and guards, which already works and adds no vocabulary. If a reference
workflow needs genuine signalling rather than shared state, broadcast events get
their own decision, with routing rules and a trace kind.

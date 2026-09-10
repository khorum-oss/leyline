# 0030. Regions are claimable, and slots are functions

- **Status:** accepted
- **Date:** 2026-09-10
- **Closes:** the region-claiming debt left by [0019](0019-section-nodes.md)

## Context

Decision 0019 said "renderer registries learn to claim regions, not only
surfaces — a modest extension of AD5's ranked predicates", and stage 2 did not
implement it. A section is drawn by _something_: swapping a one-column container
for a two-column one is the same operation as swapping a table for a card grid,
and nothing could express it.

The complication is that `match` already had a meaning. A match naming only
`nodeId` means "every surface on that node", so it could not also mean "that
node's own container" without becoming ambiguous.

## Decision

**A `target` discriminator on the match**: `'surface'` or `'region'`, defaulting
to `surface` so every entry written before this keeps its meaning (AD8). Region
matches take `nodeId` and a new `nodeKind`, so "the dashboard specifically" and
"every section" are both expressible. One registry, one ranked resolution, one
change kind.

Every active node is a region, not only sections. A hub is drawn by whichever
renderer claims it, exactly like a surface.

**Named slots, as functions.** A region renderer receives `surfaces` and
`regions`, each an array of `{ id, …, render() }` in reading order. It decides
where each goes and calls `render()` when it has decided.

Handing over pre-rendered elements would have the adapter deciding something the
component was supposed to decide, and would render every child whether the
section used it or not. Passing them as React children would lose the identity a
two-column container needs in order to put _navigation_ in the aside.

The slots are called rather than mounted as components. A render function is
rebuilt on every snapshot, so React would treat each one as a new component type
and remount the subtree, losing any state inside it.

**The fallback is an ordinary catalogue entry** claiming `*` at rank 0 — so it
is inspectable through `describe()`, replaceable through the control plane, and
revertible, rather than a privileged component the constitution rules out.
`WorkflowView` also ships a built-in last resort, because a registry with
nothing in it should render a visible placeholder rather than a blank page with
no explanation. A registered fallback resolves, so it wins over the built-in.

The core reports an unclaimed surface as `surface.unresolved` on the trace
stream. Rendering a placeholder is normal operation, not a fault — but "why is
this drawn as a placeholder" is exactly the question the stream exists for.

## Consequences

Appearance is swappable at container level, not only at leaf level, which is
what a viewer rearranging their own page actually needs (decision 0020).

The React adapter holds no workflow logic: guards are evaluated, data sources
attached, and reading order decided before a snapshot arrives. Two renderers
arrange the same three regions differently from the same document, which is the
claim G6 makes and now the thing a test asserts.

## Alternatives considered

**A separate region registry.** Rejected: it doubles the registry vocabulary,
the control-plane surface, and what `describe()` has to explain to an agent.

**A synthetic `section` surface on every section node.** Rejected: it puts a
surface in the document that no author wrote, so `describe()` and the fixture
corpus would disagree with what the schema says is there.

**A `fallback` prop on `WorkflowView`.** Rejected: it puts one renderer outside
the registry, where it cannot be inspected, swapped, or reverted — a small
privileged path, and the constitution has no small ones.

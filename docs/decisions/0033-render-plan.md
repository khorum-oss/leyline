# 0033. The render plan lives in the core

- **Status:** accepted
- **Date:** 2026-09-13

## Context

The React adapter walked the active tree, asked the registry what claimed each
region and each surface, noticed where nothing did, and built slots. That was
right for one adapter, and the roadmap put stage 6 where it is precisely to find
out whether it stayed right for three.

It did not. Writing the vanilla adapter reproduced the same walk in DOM terms;
starting the Svelte one was about to reproduce it a third time. None of it is
framework work: it is reading a snapshot and asking a registry questions.

The constitution is explicit about what to do here — logic appearing in two
adapters belongs in the core, and duplicating it a second time is a defect
report against the core rather than an acceptable cost.

## Decision

`buildRenderPlan(resolver, region)` in `@leyline/core` resolves an active tree
into a **render plan**: for each region, what claims it, its surfaces with what
claims each of those, and its active children, all in reading order.

A plan is a snapshot of a decision, not a rendering. It holds identifiers,
resolved surfaces, and whatever opaque component each registry entry carries. It
never calls one. Turning a plan into output is the entire remaining job of an
adapter.

`undefined` in a plan's `renderer` means nothing claimed it. That is normal
operation, not an error: the adapter draws its own fallback and the core has
already reported `surface.unresolved` (AD5).

## Consequences

The React adapter lost its walk and kept all eighteen of its tests passing
unchanged, which is the clearest evidence that the plan captured exactly what
was there and nothing more.

The three adapters now differ only in how their framework mounts things: React
calls a function returning an element, Svelte mounts a component with props,
vanilla appends a node. Everything before that point is identical, and lives in
one place.

Adding a fourth framework is now a file that turns a plan into that framework's
output. That is what G5 promised and what this stage existed to check.

## Alternatives considered

**Leave it in each adapter.** Rejected by the constitution, and it would have
meant three places to fix the day ranked resolution or fallback selection
changes.

**A shared internal package the adapters depend on.** Rejected: it is core
behaviour — it reads snapshots and queries registries, both core concepts — and
a fourth package would exist only to avoid admitting that.

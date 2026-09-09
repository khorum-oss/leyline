# 0020. Personalization is control-plane traffic

- **Status:** accepted
- **Date:** 2026-09-09
- **Bears on:** OQ1 (persistence), OQ2 (policy granularity)

## Context

An application built on Leyline can hand its own users the ability to rearrange
their view: move the activity feed above the workspace, drop a panel they never
read, choose a denser container. Every ingredient already exists — sections
(0019) give containment, ranked registries (AD5) give presentation, guards give
presence, and the control plane (AD10) is the one path through which any of it
changes.

What did not exist was a way to tell a _viewer_ apart from an application, a
developer, or an agent. Without that distinction, an application cannot express
"my users may reorder their own regions, and may never touch a guard or a
service."

## Decision

**End users are a fourth initiator kind, `user`**, alongside `application`,
`developer`, and `agent`. Policy receives it like any other and decides what it
permits (AD13).

**Personalization is expressed as ordinary changes**, not as a separate
subsystem:

- `section.reorder-children` — reading order within a container
- `section.move-child` — which container holds a region
- `renderer.register` — swapping a container or a surface for another the
  application already made discoverable (I3)
- `surface.attach-guard` / `surface.detach-guard` — hiding what a viewer does
  not want

Nothing in that list is new machinery. A viewer rearranging a page and an agent
swapping a table travel the same path, meet the same policy, produce the same
change records, and revert the same way.

**A viewer never writes arrangement.** They reorder semantic containers and
choose among renderers the application published. The document stays free of
layout, and the set of presentations a viewer can reach stays exactly the set
the application decided to offer — which is also what stops personalization
becoming an unbounded surface for support to reason about.

## Consequences

Reverting is free: personalization is a change log, so "reset my layout" is a
revert rather than a feature.

The audit trail covers viewers too. A support engineer asking "why does this
user's page look like that" reads change records rather than guessing.

Policy carries more weight than before. An application offering personalization
in production has a real reason to write one, and the safe default — deny agent
initiators when no policy is configured — should be considered for `user`
initiators as well when the runtime mode is production. Settled in stage 2.

**OQ1 needs a stronger answer than it had.** "Ephemeral by default with an
export operation" suits a developer swapping a renderer at a REPL. It does not
suit a viewer whose preferences must survive a reload, on their account, across
devices. Stage 2 decides between a pluggable persistence hook and something
narrower; the constraint is now recorded in the question.

## Alternatives considered

**A separate preferences system beside the control plane.** Rejected by the
no-privileged-path rule in the constitution: two mutation paths means two sets
of safety checks, and the weaker one becomes the way in.

**Let viewers edit the workflow document directly.** Rejected: it hands an end
user the graph, the capability names, and the sequencing, none of which is
theirs to change, and it makes every personalization a schema migration.

**Layout preferences as free-form values in context.** Rejected: context is
inert data by I4, and reading it as arrangement would be exactly the
interpretation I4 forbids.

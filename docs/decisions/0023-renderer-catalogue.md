# 0023. Renderers are discoverable through a catalogue

- **Status:** accepted
- **Date:** 2026-09-10
- **Closes:** OQ3

## Context

I3 requires that a change registering a renderer can only name one the
application has already made discoverable. That was recorded as an invariant
before anything defined what "discoverable" meant, and the control plane cannot
enforce it without an answer.

## Decision

An application supplies a **catalogue** at construction: `{ id, description,
claims, component }` per renderer. The core keeps the metadata and holds the
component as an opaque value it never inspects — which is how a registry lives
in a framework-free package while still being the object the control plane
mutates.

A change may name a catalogue id and nothing else. Naming anything absent fails
as `renderer.undiscoverable`, with the available ids in the suggestion. Naming a
renderer that does not claim the surface type fails as `renderer.does-not-claim`.

`describe()` exposes id, description, and claims, so an agent discovers "CardGrid
draws datatable surfaces" without reading application source. It never exposes
the component.

## Consequences

The symmetry with the capability bundle is the point: guards, services, data
sources, and renderers are all things a document references by name and an
application supplies by implementation. One rule to learn, one place to look
when something is refused.

The set of presentations an initiator can reach is exactly the set the
application chose to publish — which also bounds what support has to reason
about when a viewer's page looks unfamiliar.

## Alternatives considered

**Metadata in the core, components in the adapter.** Rejected: two structures to
keep in sync, and a mismatch surfaces at paint time rather than at registration.

**Application code registers directly; the control plane may only re-rank.**
Rejected: it makes the §2 agent scenario awkward, since the card grid would have
to be pre-registered at some rank the agent then has to outbid.

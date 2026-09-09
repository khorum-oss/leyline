# 0016. The v1 surface set

- **Status:** accepted
- **Date:** 2026-09-09
- **Closes:** OQ5

## Context

Every surface type becomes a permanent obligation for every renderer registry
anyone ever writes, including registries outside this repository. The cost of
adding one is paid forever; the cost of omitting one is paid once, by whoever
needs it, in a conversation that produces evidence.

Brief §2 is the acceptance benchmark, and it needs a form, a data table, a
metrics panel, and navigable links. Rendering static copy — a failure message,
an explanatory line — has no home among those four.

## Decision

v1 defines exactly five surface types: `form`, `datatable`, `metric-panel`,
`link`, and `text`.

`link` carries a `target` naming a node. Navigation therefore appears in the
graph rather than beside it, and reachability analysis sees the edges a hub's
links create.

A sixth type needs two independent real workflows that want it and a decision
recorded here. "A renderer could use it" does not qualify; a registry can
already claim any surface by type or identifier at whatever rank it likes.

## Consequences

The vocabulary stays small enough that a renderer registry is a short file, and
an agent reading `describe()` meets five nouns rather than fifty.

Applications wanting a richer taxonomy express it through props and ranked
renderers instead of new types — a card grid is a `datatable` a different
renderer claimed, not a `cardgrid` surface. That is the mechanism AD5 exists to
provide, and the §2 agent scenario is exactly this case.

## Alternatives considered

**Ship the surface types a component library would need.** Rejected: it makes
Leyline a component library's schema, and the non-goals in brief §4 rule that
out explicitly.

**Leave the set open with no vocabulary at all.** Rejected: a registry cannot
offer a sensible default for a type nobody has defined, and an agent inspecting
the workflow would have nothing to reason about.

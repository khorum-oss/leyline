# 0021. Trace retention and export

- **Status:** accepted
- **Date:** 2026-09-09
- **Closes:** OQ6

## Context

The trace stream is where a developer reconstructs what happened. A stream you
can only watch live is a stream you can only debug live — which is the one
moment nobody is watching.

The constraint pulling the other way is AD15's: with no sink attached, emission
must be a guard check that allocates nothing. A buffer that is always on is a
consumer that is always there.

## Decision

The core keeps a **bounded in-memory ring buffer**, sized by runtime mode:
roughly two hundred events in development, none in production unless configured.
Development gets `recent()` and devtools with no setup; a production instance
nobody is observing allocates nothing, because with no buffer and no sink every
kind reports itself disabled.

`export()` returns a serializable bundle: the events, the workflow identifier,
the schema version, the buffer capacity, and **how many events were dropped**.

That last field is the one that matters. A bundle that silently lost its first
thousand events would have a reader reconstructing a causal chain that never
happened, and confidently. Naming the loss makes the bundle honest about its own
edges.

Redaction runs before the buffer, not just before sinks, so `export()` cannot
disclose what a sink was not allowed to see.

**Sinks may be attached at construction.** Binding and the entry node's first
service invocation both happen inside `createWorkflow`, so a sink attached
afterwards would miss them. This surfaced as a failing completeness test rather
than as a review comment, which is the argument for having written the harness.

## Consequences

"Attach this to the bug report" and "replay this elsewhere" are one call each.

Import is deliberately not included. Replaying a bundle to reconstruct a change
log is a real use, but it belongs with the change log itself, where the replay
can go through policy like any other application. It lands with the control
plane.

## Alternatives considered

**`recent(n)` only; export belongs to sinks.** Rejected: every consumer then
writes the same twenty lines, and bug reports arrive in whatever shape each one
chose.

**Export and import together now.** Deferred rather than rejected. Import
without the change log has nothing meaningful to reconstruct.

**An always-on buffer.** Rejected: it makes "zero cost when unobserved"
false, and that property is what lets the stream stay in production code.

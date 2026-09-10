# 0028. Persistence is a sink plus hydrate

- **Status:** accepted
- **Date:** 2026-09-10
- **Closes:** OQ1

## Context

"Ephemeral by default with an export operation" suited a developer swapping a
renderer at a REPL. Decision 0020 made end users initiators, and a viewer's
preferences have to survive a reload, on their account, possibly across devices.

The core has no business knowing about any of that. Where preferences live,
whose they are, and how long they last are application questions with different
answers per application.

## Decision

The core persists nothing. It emits `control.applied` and `control.reverted`
records on the trace stream, and accepts records back through
`control.hydrate(records)`.

**Hydration replays through policy.** Each record is re-proposed with its
recorded initiator, so it meets the current policy rather than the one that was
in force when it was first applied. A change the initiator is no longer entitled
to is dropped, with a reason, rather than restored. Records already reverted are
skipped, and so are the reverts themselves — skipping the first already
expresses the second.

## Consequences

An application stores records wherever it likes: `localStorage`, its own
backend, per user, per device. Nothing in the core has an opinion.

The security property is the one worth having. A viewer whose personalization
permission was withdrawn does not keep it on reload because it was allowed last
Tuesday.

Change records are plain JSON, so persisting them is `JSON.stringify` and
restoring them is one call.

## Alternatives considered

**A pluggable persistence adapter in the core.** Rejected: the core would then
own when to save, how to scope, and what to do on a failed write — all of which
vary per application, and none of which it can answer well.

**Ship a localStorage adapter.** Rejected: localStorage is per-device, so it
would quietly fail to do what "across devices" implies, and a shipped default
becomes the thing everyone uses.

# 0026. Revert replays the log

- **Status:** accepted
- **Date:** 2026-09-10

## Context

AD11 says reverting an earlier change "replays later ones against the restored
state, or fails validation with a precise explanation". That describes the
behaviour without settling the mechanism, and the two candidates differ in what
they can get wrong.

## Decision

Revert is itself a change — `change.revert`, naming the record it undoes — so it
meets policy, produces a record, and appears in the log like anything else.
Reverting a revert needs no special case.

Applying one recomputes state by replaying the log from the initial state,
skipping whatever is reverted and re-validating each remaining change as it
goes. A later change that no longer validates fails the revert, naming the
record and the reason, rather than leaving state behind that no sequence of
changes could have produced.

Whether a change still stands is resolved recursively: a change is reverted if
some revert targets it and that revert has not itself been reverted. A simple
toggle gets this wrong as soon as a revert of a revert appears, because the
second one targets the first revert rather than the original change. That was a
failing test before it was a paragraph.

## Consequences

No per-kind inverse operation exists, so no inverse can be subtly wrong. "Reset
my layout" is a replay against an empty log.

Cost is linear in log length per revert, on a log that is short by nature and
bounded by whatever the application chooses to persist.

## Alternatives considered

**An inverse per change kind.** Rejected: several are genuinely subtle — what is
the inverse of `workflow.replace`? — and a bug in one produces unreachable state.

**Snapshot state before each apply.** Rejected: it stores whole states rather
than descriptions, which is exactly what AD15 keeps off the trace stream, and it
would make the log heavy.

# 0029. The change log is kept alongside the stream, and tested against it

- **Status:** accepted
- **Date:** 2026-09-10
- **Refines:** AD15

## Context

AD15 states that the change log is a projection of the trace stream, "derived
from `apply` and `revert` trace events, not maintained separately", so that the
audit trail and the observability stream can never disagree.

Implementation revealed a conflict with another AD15 requirement. The trace
buffer is bounded, and in production it is absent by default so that an
unobserved instance allocates nothing. A log genuinely computed from the stream
would therefore lose records as the buffer rolled — or force the buffer to be
unbounded and always on, which the zero-cost property forbids.

Both cannot hold. Recording the deviation is better than quietly implementing
one and citing the other.

## Decision

The control plane maintains the change log, and emits `control.applied` and
`control.reverted` for every entry.

"They cannot disagree" becomes a tested property rather than a structural
guarantee: `log.test.ts` reconstructs the log from the stream alone and asserts
it matches, entry for entry and in order, including reverts and including
changes that never applied.

## Consequences

The log survives regardless of buffer capacity or runtime mode, which is what
makes it usable as the thing an application persists (decision 0028).

The guarantee now rests on a test, so the test is load-bearing: a change to how
records are made or events are emitted must keep it passing, and it belongs in
the same required gate as the invariant suites.

AD15's wording should be read as stating the requirement — the two must agree —
rather than prescribing projection as the mechanism.

## Alternatives considered

**An unbounded, always-on buffer so the log really is a projection.** Rejected:
it contradicts "zero cost when unobserved", which is the property that lets the
stream stay switched on in production.

**Derive the log from the buffer and accept the loss.** Rejected: an audit trail
that silently forgets is worse than no audit trail, because it looks complete.

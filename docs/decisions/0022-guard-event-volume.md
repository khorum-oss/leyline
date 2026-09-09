# 0022. Guard evaluations emit like everything else

- **Status:** accepted
- **Date:** 2026-09-09
- **Closes:** OQ8

## Context

Guard evaluations are the highest-frequency thing Leyline does. Every surface
with a `when`, every guarded transition, on every snapshot publication. The
worry behind OQ8 was a devtools panel attaching a sink and drowning.

Against that sits a constraint from brief §8: every state change emits a trace
event, with a test harness asserting stream completeness. A guard that decided a
panel was invisible and said nothing leaves "why is this panel missing" as the
one question the stream cannot answer — which is precisely the question the
stream exists for.

## Decision

**Every kind emits by default, guard evaluations included**, with
`setEnabledKinds` as the lever for anyone who wants less.

The reasoning turns on a property AD15 already required: with no sink attached
and no buffer, emission allocates nothing. Volume is therefore only ever a cost
to someone who already chose to listen — and someone listening can filter.
Optimising the default for a consumer who has not arrived would make the stream
incomplete for the one who has.

Hot paths check `isEnabled(kind)` before assembling a payload, so a disabled
kind costs one boolean rather than an object nobody reads. Guard evaluation is
the reason that method exists.

## Consequences

The completeness guarantee needs no asterisk: the default stream really does
account for everything, which is what the completeness harness asserts.

A consumer wanting only transitions and control-plane events writes one call.
The choice sits with whoever is reading rather than being baked into a default
they cannot see.

## Alternatives considered

**Guard events off by default.** Rejected: it makes the default stream
incomplete, so the guarantee needs qualifying and "why can't I see why this
guard failed" becomes a support question with an unsatisfying answer.

**Batch guard evaluations into one event per snapshot.** Rejected: the payload
then grows with the number of guards, pushing against the few-hundred-bytes
ceiling that keeps events cheap enough to leave on. The batching also loses the
ordering between a guard and the transition it gated.

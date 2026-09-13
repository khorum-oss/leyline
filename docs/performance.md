# Performance

One performance claim in this project is load-bearing: **tracing that nobody
reads costs one boolean check** (AD15). Everything else about observability
follows from it — the single ordered stream, the always-on emitter, the
[trace stream](glossary.md#trace-stream) that an application can leave wired up
in production without thinking about it.

A claim that load-bearing needs a number, and it needs a test, and they are not
the same thing. The benchmark reports; the test decides.

## Running the benchmarks

```bash
pnpm bench
```

The suite lives in
[`packages/core/src/trace/observation-cost.bench.ts`](../packages/core/src/trace/observation-cost.bench.ts)
and measures two layers: the emitter on its own, and a whole render pass through
a workflow with the [§2 reference document](../packages/schema/src/fixtures/)
loaded.

A render pass is `getSnapshot()` followed by an event the machine ignores. The
ignored event is deliberate — it makes the interpreter publish without changing
anything, which is exactly the shape of the cost in question: the work spent
deciding whether there is anything to report.

## A recorded run

Intel Xeon @ 2.80GHz, 4 cores · Node v22.22.2 · Linux 6.18 · Vitest 3.2.7.
Higher is better; `rme` is the reported margin of error.

| the emitter alone                    |    ops/sec |    rme |
| ------------------------------------ | ---------: | -----: |
| `isEnabled` — the check itself       | 11,431,945 | ±0.33% |
| `emit` — nothing attached, no buffer | 10,150,290 | ±0.31% |
| `emit` — into the ring buffer        |  2,767,035 | ±1.17% |
| `emit` — into one sink               |  2,646,254 | ±0.41% |

**An unobserved `emit` runs within 13% of the bare check it performs**, on a
measurement whose margin of error is a third of a percent. That is the claim,
and the gap between the two is the function call and the early return. Attaching
anything at all — a buffer or a sink — costs roughly 4×, which is the honest
price of an event actually coming into being.

| a render pass, by who is watching           | ops/sec |    rme |
| ------------------------------------------- | ------: | -----: |
| unobserved — production, no sink, no buffer | 387,106 | ±3.34% |
| observed — a sink on every kind             | 289,745 | ±3.71% |
| buffered — development ring buffer, no sink | 286,179 | ±3.27% |

Observation costs about a quarter of a render pass when something is observing,
and nothing when nothing is. Note that the development ring buffer costs the
same as a sink, because it is one: `recent()` works without setup precisely
because development pays that price by default and production does not.

## What the benchmark cannot tell you

Numbers this close together drift with the machine, the Node version, and
whatever else the CI runner is doing. A 6% regression would not be visible here,
and a 6% regression is exactly what a single unguarded payload construction on a
hot path looks like.

So the property is held by tests instead, in
[`observation-cost.test.ts`](../packages/core/src/trace/observation-cost.test.ts),
and they fail rather than merely slow:

- **The emitter constructs nothing.** `now()` is called exactly once per event
  the emitter builds. A full scenario run in production with no sink calls it
  zero times — no envelope, no timestamp, no sequence number ever existed.
- **Callers assemble nothing to hand it.** The emitter cannot help with this:
  by the time `emit` can refuse, its argument has already been built. So every
  hot path asks `isEnabled` first, and the engine's two hot paths are covered by
  an observer that treats being called at all as the failure.

The second test is the one that found a defect. Describing a transition means
flattening the active tree twice and comparing the results, and the engine did
that on every published snapshot — work whose only consumer was a trace event
that, unobserved, was then discarded. The fix generalised the engine observer's
`guardTracingEnabled()` into `tracingEnabled(kind)` and asked it first.

It is worth about 6% of a render pass on the reference workflow, which is at the
edge of what the benchmark above can resolve — and considerably more on a deep
[section](glossary.md#section) tree, since the discarded work grows with the
tree while the check does not. The reason to fix it was never the 6%. It was
that the work existed to describe something nobody had asked to be told.

## Tracing in production

[Decision 0021](decisions/0021-trace-retention-and-export.md) sets the
retention policy the numbers above reflect: a development
[ring buffer](glossary.md#ring-buffer) of 200 events so `recent()` works without
setup, and no buffer at all in production so an unobserved instance allocates
nothing.

An application that wants production tracing opts in by attaching a sink, and
pays the ~4× on the events it asked for. Two levers narrow that:

- `setEnabledKinds([...])` silences whole kinds. `guard.evaluated` is the one
  worth considering first — it fires on every render pass, which is why
  [OQ8](decisions/0022-guard-event-volume.md) singled it out.
- `setRedaction(hook)` runs before anything sees the payload, buffer included,
  so a redacted field is never held anywhere.

Both are on the [`TraceStream`](../packages/core/src/trace.ts) handle.

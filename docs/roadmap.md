# Delivery sequence

Each stage produces a working, tested artifact. Two orderings carry weight and
resist rearranging: stage 4 lands before the second and third adapters, so that
a control plane needing framework knowledge shows up as a core defect early; and
stage 6 lands within v1, because two more adapters are the only honest test of
whether the core stayed headless.

Stage scopes use the project vocabulary throughout; [`glossary.md`](glossary.md)
defines it.

| Stage | Scope                                                                                                                                                                                                                                                                                                                   | Exit criteria                                                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **Schema foundation** — Zod definitions for the minimal node and surface set, graph validation (dangling targets, unreachable nodes, undeclared capabilities), stable identifier rules, JSON Schema export, change-description schemas                                                                                  | The §2 workflow round-trips as a JSON document; graph validation rejects each malformed case by name; JSON Schema exports and validates the same corpus            |
| 2     | **Core runtime, control plane, trace stream** — interpreter over the XState facade, store, capability binding and verification, control-plane-addressable registries, trace emitter with ring-buffer and console sinks, change log projected from the stream, propose/validate/apply/revert, policy and redaction hooks | §2 items 1–5 drive headlessly with no DOM; every AD14 invariant has a suite that tries to break it; replaying a trace stream reconstructs the identical change log |
| 3     | **React adapter** — reactivity bridge, ranked renderer registry, `WorkflowView`                                                                                                                                                                                                                                         | §2 items 1–5 run end to end in a React application; the adapter holds no workflow logic                                                                            |
| 4     | **Agent interface** — introspection, operation descriptors, MCP adapter                                                                                                                                                                                                                                                 | §2 items 6–7 run end to end with a real agent driving the React application through MCP, with no access to application source                                      |
| 5     | **TypeScript DSL** — builder emitting validated schema with compile-time node reference checking                                                                                                                                                                                                                        | The §2 workflow authored through the DSL emits a document byte-identical to the hand-written one                                                                   |
| 6     | **Svelte and vanilla adapters**                                                                                                                                                                                                                                                                                         | §2 items 6–7 re-run against the SvelteKit application with no change to `@leyline/agent`; anything an adapter had to duplicate has moved into the core             |
| 7     | **Hardening** — devtools inspector, OpenTelemetry sink, finalized threat model, versioning policy, authoring guide, agent integration guide, migration guidance                                                                                                                                                         | Benchmarks show unobserved tracing within noise; `SECURITY.md` matches the shipped invariant suites                                                                |

## Stage order

Two orderings resist rearranging, and the graph shows why: stage 4 sits on the
critical path _before_ the second and third adapters, and stage 6 sits inside
v1 rather than after it.

```mermaid
flowchart LR
    S1["1 · Schema<br/>foundation"]
    S2["2 · Core runtime<br/>control plane · trace"]
    S3["3 · React<br/>adapter"]
    S4["4 · Agent interface<br/>MCP"]
    S5["5 · TypeScript<br/>DSL"]
    S6["6 · Svelte and<br/>vanilla adapters"]
    S7["7 · Hardening"]

    S1 --> S2 --> S3 --> S4 --> S6 --> S7
    S2 --> S5 --> S6

    S4 -. "a control plane needing framework<br/>knowledge is a core defect" .-> S2
    S6 -. "logic an adapter had to duplicate<br/>moves back into the core" .-> S2
```

The dotted edges are the feedback each stage is designed to produce. Finding
either one late costs a redesign; finding it on schedule costs a refactor.

## Current position

**Stage 2 complete.** The runtime runs and the control plane operates it. Brief
§2 items 1–7 all pass: the workflow drives headlessly, and an agent with no
access to application source swaps the actions table for a card grid in two
calls, reverts it in one, and hides the metrics panel by attaching a guard.

Every AD14 invariant has a suite that tries to break it. Change records and the
trace stream are asserted to agree entry for entry, and a recorded log replayed
against a fresh instance reproduces the same state.

Seven decisions came out of it, four closing open questions:
[0023](decisions/0023-renderer-catalogue.md) (OQ3),
[0024](decisions/0024-policy-shape.md) (OQ2),
[0025](decisions/0025-live-changes.md),
[0026](decisions/0026-revert-by-replay.md),
[0027](decisions/0027-confirmation-flow.md) (OQ4),
[0028](decisions/0028-persistence.md) (OQ1), and
[0029](decisions/0029-change-log-and-stream.md), which records a deviation from
AD15 rather than quietly implementing one thing and citing another.

OQ7 is the only open question left, and it belongs to stage 4.

**Stage 3** is next: the React adapter — the reactivity bridge already exists,
so the work is the ranked registry bridge and `WorkflowView`, proving §2 items
1–5 in a real application.

Post-v1: `@leyline/devtools` and `@leyline/otel`, plus the Kotlin authoring
track described in brief §10, which coordinates through the exported JSON Schema
and a shared fixture corpus.

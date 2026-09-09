# Leyline — Project Brief

> **Purpose of this document.** This is the holistic context document for spec-driven development. An agent reading this should have enough grounding to produce a project constitution, feature specifications, and implementation plans without further background. It describes _what_ the system must do and _why_, plus the architectural decisions already made. It deliberately does not prescribe file-level implementation details; those belong in the generated specs and plans.

> **Name.** _Leyline_: the invisible lines said to connect significant places into a network. The metaphor carries the design — nodes joined by lines, the lines themselves never rendered, the topology present whatever gets built on top. Package scope is `@leyline/*`.

---

## 1. Problem Statement

Application UIs accumulate knowledge that does not belong to them. A UI does not merely call APIs; it encodes:

- **Sequencing** — API C cannot run until A and B have completed.
- **Eligibility** — this action exists only when the account has a paid tier.
- **Navigation topology** — completing this step leads to one of three destinations depending on state.
- **Composition** — this screen needs a data table, a metrics summary, and links to two follow-on actions.

Because that knowledge lives inside components, changing how the UI looks, migrating to a different framework, or hiding a capability for a subset of users all become risky refactors rather than configuration changes. Two applications sharing the same backend workflows must each reimplement the workflow logic. And an AI agent asked to "swap the actions table for a card grid" has no safe, structured way to do so; it must edit component source and hope.

**The goal:** extract workflow knowledge into a portable, declarative, framework-agnostic layer, leaving UI frameworks responsible only for appearance and interaction, and expose that layer so that both humans and AI agents can inspect and reshape it through a structured, validated interface.

---

## 2. Concrete Motivating Scenario

The scenario below should be treated as the acceptance benchmark for v1. Any design that cannot express it cleanly has failed.

1. A user creates a **workspace**. This calls a workspace-creation API.
2. If the workspace tier is _paid_ or _organization_, the user must complete a **management/billing** step. Free-tier workspaces skip it entirely.
3. The user arrives at a **workspace hub**, which displays:
   - a data table of available actions,
   - a panel of workspace metrics,
   - navigable links to _Action Two_ and _Action Three_.
4. _Action Two_ appears only when workspace state permits it. When state changes, the link appears or disappears without a page reconstruction.
5. _Action Two_ and _Action Three_ each run their own multi-call sequences and return to the hub.

**Agent extension of the scenario (also v1 acceptance):**

6. An AI agent, given access to Leyline's agent interface and no access to application source, is asked to replace the actions table with a card-grid presentation. It must be able to discover the current surface and its registered renderer, propose a replacement, validate the proposal, apply it, and revert it, all through structured calls whose effects are observable in the running application.
7. The same agent is asked to hide the metrics panel for free-tier workspaces. It must be able to attach a guard to that surface, with the change validated against declared capabilities before application.

Three additional requirements apply:

- The entire visual presentation must be replaceable without editing the workflow definition.
- The same workflow definition must drive a React application and a SvelteKit application.
- The workflow definition must be serializable data, not code.

---

## 3. Goals

**G1. Workflow knowledge lives outside the UI.** Sequencing, guards, and navigation are defined once, in a framework-neutral form, and consumed by any renderer.

**G2. The canonical artifact is a serializable schema.** A workflow is a JSON-compatible document. Every other tool in the system either produces or consumes that document.

**G3. Authoring is type-safe and pleasant.** A TypeScript builder DSL emits schema documents with compile-time validation of node references, context shape, and capability names.

**G4. The runtime core is headless.** Zero framework dependencies. Distributed as compiled JavaScript with TypeScript types, usable directly from plain JS.

**G5. Framework adapters are thin.** Adding support for a new framework should be a small, well-understood task, not a re-implementation. React and Svelte adapters ship in v1; a vanilla DOM adapter serves as both a reference implementation and proof that the core is genuinely headless.

**G6. Appearance is registry-driven.** Schema declares semantic intent (`datatable`, `metric-panel`, `link`). A renderer registry maps intent to concrete components. Swapping the registry restyles the application.

**G7. Conditional presence is first-class.** Surfaces and transitions carry guards. Elements appearing and disappearing in response to state is normal operation, not a special case.

**G8. Failures surface early.** A workflow schema declares the capabilities it requires. Binding a schema to an implementation bundle that lacks a required guard, service, or data source fails at registration time with a precise error, not at click time.

**G9. Agents are first-class operators of the layer.** Everything a developer can do to a workflow or a registry, an AI agent can do through a structured interface: inspect the current schema and registries, propose changes, have them validated, apply them, observe the effect, and revert. The interface is designed for machine consumption first: self-describing, schema-typed, deterministic, and safe by default. This is not a devtools afterthought; the agent interface and the human interface are the same interface with different clients.

**G10. Every change is traceable and auditable.** A developer must be able to answer "what changed, when, by whom, and why" for any workflow transition, registry mutation, or policy decision, from a stream of lightweight structured messages, without attaching a debugger or a heavyweight telemetry stack. Observability is a core emission, not an optional plugin, but its cost when nobody is listening must be negligible.

---

## 4. Non-Goals (v1)

Explicitly out of scope. Reject specs that expand into these without a deliberate decision.

- **A component library.** Leyline renders nothing itself. It has no opinion about styling, no CSS, no design tokens.
- **A state management library.** Application-wide state beyond workflow context is somebody else's concern.
- **Backend orchestration.** Workflows here are client-side. Durable, cross-session, server-executed workflows are a different problem with different tools.
- **Layout control.** Schema expresses semantic intent, never layout primitives. A schema that can express "div with flex-direction row" has become a worse HTML and has failed.
- **Server-delivered schemas.** The architecture must not _preclude_ fetching schemas from a server, but v1 assumes schemas are bundled with the application.
- **Visual editing tools.** Enabled by the design; not built in v1. (The agent interface is the substrate a visual editor would also use.)
- **Generating components.** The agent interface lets agents _select and swap_ registered renderers and _reshape_ workflows. Authoring new React or Svelte components remains a code-editing task outside Leyline. Leyline makes the result of that authoring registrable and discoverable.
- **Non-TypeScript authoring DSLs.** A Kotlin DSL emitting the same schema is a planned independent track (see §10), not part of this scope.

---

## 5. Architectural Decisions Already Made

These are settled. Specs should implement them rather than re-litigate them, unless implementation reveals a concrete blocker.

### AD1. Canonical schema, DSL as a producer

The serializable schema document is the source of truth. The TypeScript DSL is a convenience layer that emits schema. Hand-written JSON, code-generated JSON, agent-generated JSON, and DSL output are equally valid inputs to the runtime. This keeps the system open to other authoring languages, server delivery, versioning, diffable review, and tooling.

### AD2. Names, not functions, in schema

Guards, services, and data sources appear in the schema as string identifiers. Implementations bind separately at runtime through a capability bundle. This is what keeps the schema serializable, the logic independently testable, and agent-authored schemas safe (an agent can reference a guard; it cannot inject executable code through the schema).

### AD3. Statechart semantics for sequencing

Workflow nodes, guarded transitions, and invoked services follow statechart semantics (states, guards, invoke lifecycles, hierarchical composition). **XState should be used as the internal engine, hidden behind an internal facade.** The public API and the schema must never expose XState types or concepts. Rationale: statechart edge cases (invoke cancellation, error transitions, parallel regions) are numerous and already solved; the facade preserves the option of replacing it with a smaller purpose-built interpreter later.

### AD4. Headless core with a store contract

The core exposes a subscription-based store: `getSnapshot()`, `subscribe(listener)`, and `send(event)`. Snapshots are immutable with structural sharing so identity comparison is a valid change check. Every framework adapter bridges this contract to native reactivity (`useSyncExternalStore` in React, the store contract in Svelte, and so on). This pattern is well-proven in libraries like TanStack Query and Table.

### AD5. Ranked renderer resolution

Renderer registries resolve a surface to a component using ranked predicates rather than a flat type map. A generic `datatable` renderer can be overridden by a higher-ranked renderer that claims only a specific table. Unresolvable surfaces render a registered fallback and log; they never throw. This pattern comes from JSON Forms' tester mechanism.

### AD6. Resolved surfaces in the snapshot

The snapshot exposes the surface list for the current node with guards already evaluated and data sources already attached. Renderers receive a ready-to-render list and contain no conditional workflow logic.

### AD7. Behavior via prop-getters, not components

Where a surface needs interactive behavior (table sorting, row selection, focus management), the core exposes framework-neutral prop-getter functions on the snapshot. Adapters spread these onto native elements. The core never ships components. This pattern comes from Zag.js.

### AD8. Additive-only schema evolution

Within a major schema version, changes are additive only. Consumers encountering unknown surface types or node kinds degrade gracefully via fallbacks. Schema documents carry an explicit version identifier.

### AD9. Zod as the validation source of truth

Schema types and validators are defined once in Zod. JSON Schema is exported from those definitions so that non-TypeScript producers, including agents, validate against an identical contract. The exported JSON Schema is a published, versioned artifact.

### AD10. Registries and workflows are mutable through one control plane

Renderer registries and loaded workflow definitions are not static configuration; they are live, addressable, mutable objects exposed through a single **control plane** in the core. Every mutation goes through the same path regardless of who initiates it (application code, a developer at a REPL, a devtools panel, an AI agent). The control plane is the _only_ mutation path; there is no privileged back door for application code. This guarantees that agents and humans have identical power and identical safety checks.

### AD11. Propose, validate, apply, revert

Every mutation on the control plane follows a four-phase protocol:

1. **Propose** — a structured, serializable change description (e.g. "register renderer R for surfaces matching predicate P at rank N", "attach guard G to surface S in node X", "replace workflow W with document D").
2. **Validate** — the change is checked in isolation against the current state: schema validity, capability requirements, graph integrity, registry rank conflicts. Validation returns structured, machine-readable results, never just a boolean.
3. **Apply** — the validated change is committed atomically, producing a new immutable state and a change record with a stable identifier.
4. **Revert** — any applied change can be reverted by its identifier. Change records form an ordered log; reverting an earlier change replays later ones against the restored state, or fails validation with a precise explanation.

Dry-run (propose + validate without apply) is a first-class operation. Agents are expected to dry-run before applying.

### AD12. Stable, deterministic addressing

Every addressable thing in the system (workflow, node, surface, transition, registry entry, change record) has a stable identifier that survives serialization and does not depend on array position. Schema authors may supply identifiers; the system generates deterministic ones (content-derived, not random) where none are supplied. An agent that discovered a surface's identifier in one call can rely on it in the next.

### AD13. Policy hooks on the control plane

The control plane exposes a policy interface: a function that receives every proposed change (plus its initiator identity) and may allow, deny, or require confirmation before validation proceeds. Leyline ships a permissive default and a deny-all default; applications compose their own. This is where an application decides that agents may swap renderers but may not modify guards, or may modify guards in staging but not production. Policy decisions are recorded in the change log.

### AD14. The schema is inert: the security boundary, stated as invariants

AD2 establishes names-not-functions as a design choice. This decision elevates it to a **verified security boundary** with an explicit threat model. The party to defend against: an initiator (typically an AI agent, possibly a compromised one) who can submit arbitrary schema documents and change descriptions but must never gain execution or data access beyond what the capability bundle already grants.

The invariants, each of which must have a dedicated test suite that _attempts to violate it_:

- **I1. No executable content in schema or change documents.** Parsing and validating a document has no side effects. No field is ever `eval`'d, `new Function`'d, dynamically `import`ed, or interpreted as an expression language. Guards, services, data sources, and renderers are referenced only by opaque string identifiers resolved against registries the initiator does not control.
- **I2. Closed capability set.** A document may reference only capability names that the bound bundle already supplies. It cannot introduce a new guard, service, or data source; it can only reference existing ones. Binding rejects, rather than ignores, unknown names.
- **I3. Renderer registration is capability-gated.** A change that registers a renderer can only refer to a renderer _the application has already made discoverable_ (see §9, renderer identity). An initiator cannot supply component code through the control plane.
- **I4. Context is data, not a channel.** Values an initiator writes into context via change descriptions are validated against the workflow's declared context shape and treated as inert data by guards and services. Nothing in the core, adapters, or agent package interprets context values as identifiers, paths, URLs, or code.
- **I5. Identifiers are opaque.** Stable identifiers (AD12) carry no path, URL, or structural meaning that could be exploited by construction. Content-derived identifiers use a hash, not a concatenation.
- **I6. Policy is consulted first and cannot be bypassed.** Every proposal reaches the policy hook before validation, apply, or revert. No operation on the control plane, including revert and including operations initiated by application code, skips it. A missing policy in production mode denies agent initiators (see §8, safe defaults).
- **I7. Prototype and injection hygiene.** Documents are parsed with prototype pollution defenses; keys such as `__proto__` and `constructor` are rejected at validation. Renderer predicates receive frozen surface descriptors.

A documented threat model (`SECURITY.md` in the repository) enumerates these invariants, the attacker capabilities assumed, and what remains explicitly out of scope (for example: a malicious capability bundle supplied by the application itself is trusted by definition).

### AD15. Observability as a single lightweight emission

The core emits one ordered stream of small, structured, serializable **trace events**. Everything observable in Leyline flows through this one emitter: workflow transitions, service invocations, guard evaluations, snapshot publication, control-plane proposals and their validation results, policy decisions, applies, reverts, and binding-time verification.

Design constraints:

- **Light by default.** Events are plain objects with a fixed small envelope (`ts`, `seq`, `kind`, `correlationId`, `initiator`, and a `data` payload specific to the kind). No stack traces, no serialized snapshots, no component trees. Payloads reference things by identifier (AD12) rather than embedding them; a consumer that wants the full object asks the control plane for it.
- **Zero cost when unobserved.** With no sink attached, emission is a cheap guard check and nothing is allocated. Sinks are pull-optional: the core never buffers unboundedly on behalf of an absent consumer.
- **Correlation across layers.** A `correlationId` ties together a user event, the transition it caused, the services it invoked, and the snapshot it produced. A control-plane proposal, its policy decision, its validation, and its apply share one correlation ID. This is what lets a developer reconstruct a causal chain from the stream alone.
- **Pluggable sinks, none bundled as required.** The core ships an in-memory ring-buffer sink (for devtools and tests) and a `console` sink. An OpenTelemetry bridge (`@leyline/otel`, post-v1) maps trace events onto spans and attributes; it is an adapter over the stream, not a dependency of it.
- **The change log is a projection of the stream.** Change records (AD11) are derived from `apply` and `revert` trace events, not maintained separately. This guarantees the audit trail and the observability stream can never disagree.
- **Redaction is a sink concern with a core hook.** Context values may contain sensitive data. The core exposes a redaction hook applied before events leave the emitter; sinks receive already-redacted payloads. The default redacts nothing in development mode and redacts all context values in production mode unless an allow-list is supplied.
- **Same events for humans and agents.** Devtools, log aggregators, and agents observing their own effects all read the same stream. An agent can subscribe to trace events to confirm that an applied change produced the expected transition, closing the propose-apply-observe loop within one interface.

---

## 6. System Shape

### Package layout

| Package             | Responsibility                                                                                                                                                         | Framework deps |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `@leyline/schema`   | Zod schema definitions, validators, JSON Schema export, version rules, change-description schemas                                                                      | none           |
| `@leyline/core`     | Interpreter, store, event bus, capability binding and verification, registries, control plane, change log, policy hooks, trace emitter, built-in sinks, redaction hook | none           |
| `@leyline/dsl`      | TypeScript builder emitting validated schema documents                                                                                                                 | none           |
| `@leyline/agent`    | Machine-facing surface over the control plane: introspection, tool-style operation descriptors, MCP server adapter                                                     | none           |
| `@leyline/react`    | React reactivity bridge, `WorkflowView`, registry helpers                                                                                                              | React          |
| `@leyline/svelte`   | Svelte store bridge and component                                                                                                                                      | Svelte         |
| `@leyline/vanilla`  | Direct DOM adapter; reference implementation for plain JS                                                                                                              | none           |
| `@leyline/devtools` | Human-facing inspector consuming the same control plane and trace stream (post-v1)                                                                                     | none           |
| `@leyline/otel`     | OpenTelemetry sink mapping trace events to spans and attributes (post-v1)                                                                                              | OTel API       |

`@leyline/core`, `@leyline/schema`, and `@leyline/agent` must have no dependency on any UI framework, enforced by lint rule or dependency check in CI.

### Core concepts and vocabulary

Specs should use this vocabulary consistently.

- **Workflow** — a complete named graph with a context shape, an entry node, and a set of nodes.
- **Node** — a position in the workflow. v1 kinds: `step` (performs work, transitions onward) and `hub` (a stable destination offering navigable options).
- **Context** — the typed data a workflow instance carries; the input to guard evaluation.
- **Surface** — a declaration of semantic UI intent attached to a node (`form`, `datatable`, `metric-panel`, `link`, and a small set beyond).
- **Guard** — a named predicate over context, gating a transition or the presence of a surface.
- **Service** — a named asynchronous operation invoked by a node, whose result may be assigned into context.
- **Data source** — a named provider of data for a surface, which may be static or subscribable.
- **Capability bundle** — the runtime object supplying implementations for the guards, services, and data sources a schema requires.
- **Requirements block** — the schema's self-declared list of capability names, used for fail-fast verification at binding time.
- **Renderer registry** — an ordered, ranked set of predicates mapping surfaces to framework components.
- **Snapshot** — the immutable current state exposed to adapters: current node, context, resolved surfaces, status.
- **Control plane** — the single mutation interface over registries and workflows.
- **Change** — a serializable description of a proposed mutation, with a stable identifier once applied.
- **Change log** — the ordered record of applied changes, supporting revert.
- **Policy** — the application-supplied function that allows, denies, or gates proposed changes.
- **Initiator** — the identity attached to a change (application, developer, agent, with an optional label), recorded in the log and available to policy.
- **Operation descriptor** — a self-describing definition of one control-plane operation (name, input schema, output schema, description), consumable as a tool definition by agent frameworks.
- **Trace event** — one small structured message on the core's single observability stream, with a fixed envelope and a kind-specific payload.
- **Correlation ID** — the identifier shared by all trace events in one causal chain (a user event and everything it triggers; a proposal and everything that happens to it).
- **Sink** — a consumer attached to the trace stream (ring buffer, console, OpenTelemetry, custom).
- **Redaction hook** — the core function applied to trace payloads before any sink receives them.

### Runtime contract sketch

```
createWorkflow(schema, capabilityBundle, options?) -> instance

instance.getSnapshot()   -> { node, context, surfaces, status }
instance.subscribe(fn)   -> unsubscribe
instance.send(event)     -> void

instance.control                                     // the control plane
  .describe()            -> { workflow, nodes, surfaces, registries, capabilities }
  .propose(change, initiator) -> proposal
  .validate(proposal)    -> { ok, issues[] }
  .apply(proposal)       -> changeRecord
  .revert(changeId)      -> changeRecord
  .log()                 -> changeRecord[]
  .operations()          -> operationDescriptor[]

instance.trace                                       // the observability stream
  .attach(sink)          -> detach
  .setRedaction(fn)      -> void
  .recent(n?)            -> traceEvent[]              // from the built-in ring buffer
```

Trace events, change records, proposals, and validation issues all share the same JSON Schema definitions published by `@leyline/schema`, so a log line, an MCP tool result, and a devtools panel all speak one format.

Binding verifies the schema's requirements against the bundle and throws a descriptive aggregate error if anything is missing.

### The agent interface (`@leyline/agent`)

`@leyline/agent` adds nothing the control plane does not already do. It packages the control plane for machine consumers:

- **Introspection that reads like documentation.** `describe()` output includes human-readable descriptions alongside identifiers, so an agent can reason about "the table of available actions on the workspace hub" without a developer pre-explaining the schema.
- **Operation descriptors as tool definitions.** Every control-plane operation is exposed with a JSON Schema for its input and output. These descriptors map directly onto tool/function-calling formats and onto MCP tool definitions.
- **An MCP server adapter.** A thin adapter that serves the operation descriptors as MCP tools, so any MCP-capable agent can connect to a running Leyline instance (development or staging) and operate it. Transport and auth are the host application's concern.
- **Structured, actionable errors.** Validation issues carry the offending path, the identifier involved, the rule violated, and where possible a suggested fix, formatted for an agent to act on rather than for a human to read.
- **Idempotent, replayable operations.** Proposals are pure data; applying the same validated proposal twice is a no-op with a clear result. An agent's session against a Leyline instance can be recorded as a change log and replayed elsewhere.

The agent interface exists to make "swap the actions table for a card grid" a two-call task: `describe()` to find the surface and its current renderer, `apply(registerRenderer(...))` to override it at a higher rank. Reverting is one more call.

---

## 7. Delivery Sequence

Each stage should produce a working, tested artifact. Stage 5 is the real architectural test and must not be deferred. Stage 4 (agent interface) is deliberately placed before the second and third adapters: if the control plane turns out to require framework-specific knowledge, that is a core design defect to catch early.

1. **Schema foundation** — Zod definitions for the minimal node and surface set, graph validation (dangling targets, unreachable nodes, undeclared capabilities), stable identifier rules, JSON Schema export. Change-description schemas defined alongside.
2. **Core runtime with control plane and trace stream** — interpreter over the XState facade, store contract, capability binding and verification, registries built as control-plane-addressable objects from the start, trace emitter with ring-buffer and console sinks, change log derived from the trace stream, propose/validate/apply/revert, policy hooks, redaction hook. The AD14 invariant test suites ship in this stage, not later: each invariant gets tests that try to break it.
3. **React adapter** — reactivity bridge, registry with ranked resolution, `WorkflowView`. Prove the store contract against the §2 scenario (items 1–5) end to end.
4. **Agent interface** — `@leyline/agent` with introspection, operation descriptors, MCP adapter. Prove §2 items 6–7 end to end with a real agent driving a running React application through MCP.
5. **TypeScript DSL** — builder emitting validated schema, with compile-time node reference checking.
6. **Svelte and vanilla adapters** — the genuine test of whether the core stayed headless. Any logic that has to be duplicated in an adapter belongs in the core and must be moved there. Re-run §2 items 6–7 against the Svelte application with no changes to `@leyline/agent`.
7. **Hardening** — devtools inspector (built on the same control plane and trace stream), OpenTelemetry sink, `SECURITY.md` threat model finalized against the shipped invariant tests, documented versioning policy, authoring guide, agent integration guide, migration guidance.

---

## 8. Constraints and Quality Bar

- **TypeScript-first, JavaScript-usable.** Published packages ship compiled JS plus declaration files. No framework-specific syntax in the core.
- **The core is testable without a DOM.** Workflow behavior tests drive the interpreter directly with event sequences and assert on snapshots. Control-plane tests drive propose/validate/apply/revert directly and assert on state and log.
- **Event-log and change-log replay.** A recorded event log replayed against a schema must reproduce the same snapshots. A recorded change log replayed against an initial state must reproduce the same final state. Both are test techniques and the foundation for devtools and agent session portability.
- **Semantic vocabulary stays small.** Every surface type added becomes a permanent obligation for every renderer registry. Do not add a surface type until two independent real workflows need it.
- **Errors name the problem.** Missing capabilities, dangling transition targets, unresolvable surfaces, and rejected changes all produce messages identifying the specific path and identifier at fault, in a structure an agent can act on.
- **Adapters stay thin.** If a framework adapter grows meaningful logic, treat it as a design defect in the core rather than an acceptable cost.
- **No privileged mutation path.** If application code can change a registry or workflow in a way the control plane cannot express, that is a defect. Fix the control plane.
- **Agents cannot escalate through the schema.** Nothing in a schema document or change description can cause arbitrary code execution or reach capabilities beyond the bound bundle. AD14 states the invariants; each has an adversarial test suite that is a required CI gate. A change to the schema or control plane that lacks a corresponding adversarial test does not merge.
- **Every state change emits a trace event.** No transition, invocation, guard evaluation, proposal, policy decision, apply, or revert may occur without a corresponding event on the trace stream. A test harness that asserts stream completeness against known scenarios is part of the core test suite.
- **Trace events stay small.** An envelope plus an identifier-based payload; target a few hundred bytes per event as a working ceiling. Anything that would embed a snapshot, a component, or a full document goes through the control plane instead.
- **Unobserved tracing costs nothing measurable.** Benchmarks compare the interpreter with and without sinks attached; the difference must stay within noise.
- **The audit trail cannot drift from reality.** Because the change log is a projection of the trace stream (AD15), tests verify that replaying trace events reconstructs the identical change log.
- **Safe defaults.** A Leyline instance with no policy configured must not accept changes from an initiator identified as an agent in production mode. Development mode may default to permissive. The distinction must be explicit at construction time, not inferred.

---

## 9. Open Questions for Specification

These are not decided and should be resolved during `/specify` and `/plan`, with the decision recorded.

- **Persistence of applied changes.** An agent swaps a renderer at runtime; should that survive a page reload? Options: ephemeral by default with an explicit export-to-file operation; or a pluggable persistence hook. Ephemeral-plus-export is the suggested starting point because it keeps source control as the durable record.
- **Granularity of policy.** Per-operation, per-target-type, per-initiator, or a combination. The suggested starting point is a single predicate receiving the full proposal and initiator, with helper combinators.
- **Renderer identity across bundles.** For an agent to "swap in a card grid," a card-grid renderer must already exist in the application bundle. How renderers advertise themselves for discovery (name, description, which surface types they can claim) needs a small registration metadata contract.
- **Confirmation flow.** When policy returns "require confirmation," who confirms and how. Probably an application-supplied callback; the MCP adapter would surface it as a pending state.
- **Minimum surface set for v1.** Proposed: `form`, `datatable`, `metric-panel`, `link`, `text`. Resist expanding beyond what §2 needs.
- **Trace retention and export.** The ring buffer is bounded and in-memory. Whether the core offers a built-in export (to JSON, for attaching to a bug report or replaying elsewhere) versus leaving that entirely to sinks. A minimal `export()` on the ring buffer seems worth having.
- **Initiator identity and trust.** An initiator label is self-asserted by whoever calls the control plane. For local development that suffices; for the MCP adapter in a shared staging environment, whether Leyline should carry an authenticated identity from the transport, or leave that to the host application and treat the label as advisory. Suggested: advisory in v1, with the policy hook documented as the place to enforce anything stronger, and the trace stream recording whatever the transport provides.
- **Guard evaluation event volume.** Guard evaluations may be frequent. Whether to emit them individually, batch them per snapshot publication, or gate them behind a verbosity level. Suggested: a per-kind enable set on the emitter so guard events can be turned off without losing transitions and control-plane events.

---

## 10. Adjacent Track: Kotlin Authoring DSL

Not part of this scope, but the design must not obstruct it.

A Kotlin DSL emitting the same schema documents is planned as an independent effort. It becomes possible precisely because the schema is canonical and language-neutral. Kotlin's property delegate providers make node identifiers derivable from property names, giving compile-time reference checking without type-level machinery. Coordination between authoring DSLs happens through the exported JSON Schema plus a shared fixture corpus: both DSLs must emit byte-comparable documents for the same set of reference workflows, verified by contract tests on each side.

The relevant implication for this scope: keep the exported JSON Schema a first-class, versioned, published artifact rather than an internal detail. The same artifact serves agents generating schema documents directly.

---

## 11. Prior Art Consulted

Design decisions above draw on the following. Agents producing specs may reference these for pattern details.

- **XState** — statechart semantics, serializable machine configuration with named guards and actions, actor model, inspection protocol.
- **TanStack (Query, Table, Form)** — headless vanilla core with thin per-framework adapters bridging a subscription contract to native reactivity.
- **Zag.js** — UI behavior as framework-agnostic state machines exposing prop-getters rather than components.
- **JSON Forms** — schema-driven rendering with pluggable, ranked renderer sets; separation of data schema from UI schema.
- **Adaptive Cards** — portable semantic content descriptions rendered differently by each host.
- **Server-driven UI practice** (as documented publicly by several large product organizations) — typed section-based screen descriptions, graceful degradation for unknown types, additive-only schema evolution to survive version skew.
- **Model Context Protocol** — the tool-definition and transport conventions the agent adapter targets.
- **Event sourcing and command/query separation** — the propose/validate/apply/revert protocol, the change log, and the change-log-as-projection-of-trace-stream rule are a deliberately small application of these ideas.
- **OpenTelemetry** — target for the post-v1 sink; the trace envelope is designed so that mapping to spans and attributes is mechanical.
- **Redux DevTools and XState inspection** — precedents for a single ordered event stream powering both debugging tools and replay.

The novel contribution of Leyline is the composition: JSON Forms-style semantic rendering combined with statechart-style sequencing under a single canonical schema, with a control plane that makes the whole layer safely operable by AI agents.

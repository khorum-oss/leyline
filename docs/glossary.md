# Glossary

Leyline carries a lot of vocabulary, and several of its words look like words
from neighbouring problems while meaning something narrower here. This file is
the one place each term is defined. Every other document links here rather than
re-explaining, so a definition changes in one place or not at all.

**One file, not several.** Splitting a glossary by area sounds tidy until a
reader has to guess which file holds _guard_, or until the same word drifts
apart in two of them. The sections below are independently linkable, so a
document that means one area can point at it — [the document](#the-document),
[capabilities](#capabilities-and-binding), [the runtime](#the-runtime),
[rendering](#rendering), [the control plane](#the-control-plane),
[observability](#observability), [validation](#validation-and-reporting),
[security](#the-security-boundary), [conventions](#project-conventions).

**Conventions used here.** Each entry states what the term means, then where it
lives in code and which architectural decision governs it. _Not:_ lines mark the
distinctions that actually cause confusion. Terms in **bold** inside a
definition have their own entry.

---

## The document

The authoring vocabulary: what a Leyline document contains. All of it is
serializable data, never code (AD1, AD2).

### Workflow

A complete named graph: a **context** shape, an **entry node**, and a set of
**nodes**. One workflow describes one coherent piece of application behaviour —
onboarding a workspace, say — not a whole application.

### Workflow document

The serializable artifact holding a workflow. JSON-compatible, versioned, and
canonical: the TypeScript **DSL**, an AI **agent**, a code generator, and a
hand-written file are all equally valid producers of the same thing (AD1).

_Defined in:_ `packages/schema/src/workflow.ts`.

### Node

A position in the workflow. v1 defines three kinds: **step**, **hub**, and
**section**.

### Step

A node that performs work and transitions onward. Typically **invokes** a
**service** and routes the outcome.

### Hub

A node that is a stable destination, offering navigable options rather than
moving on by itself. The workspace hub in the reference workflow is one.

_Not:_ a step with no work to do. A hub is where a user comes to rest and
chooses; a step is somewhere they pass through.

### Section

A node that contains other nodes and governs how they run together. A page
holding a sidebar and a main panel, a panel holding a wizard, an input box
holding its own idle, editing, and validating states — one construct at every
scale.

A section declares **containment** and topology, never arrangement. Its renderer
receives the active children as named slots and decides how they sit, so a full
page and an input box are the same schema resolved to different renderers.

_Not:_ a layout primitive. Nothing in a section says width, direction, or
position. A schema able to express those has become a worse HTML and has failed
(brief §4).

_Defined in:_ `packages/schema/src/node.ts` and `containment.ts`. Governed by
[decision 0019](decisions/0019-section-nodes.md).

### Containment

The relationship between a **section** and its children. Children are named in a
`children` array rather than nested inside the parent, so the `nodes` array
stays flat and a **transition** target stays a plain identifier with no path
syntax (I5).

The tree is derived from those names, and validation checks it: unknown
children, a node claimed by two sections, a section containing itself, and an
entry node sitting inside one.

### Mode

How a section runs its children. `one` keeps exactly one child active — a wizard
advancing a screen at a time, an input box moving through its states. `many`
keeps every child active and advancing independently — a page whose sidebar,
main panel, and activity feed each hold their own state.

Both map onto statechart compound and parallel states, so the interpreter
inherits semantics rather than inventing them (AD3).

### Reading order

The order of a section's `children`: the sequence a renderer presents them in
unless a viewer has said otherwise. Semantic — the same thing source order means
in HTML, and what a screen reader follows.

_Not:_ a position. Reordering children says "this comes before that", never "put
this here".

### Cross-boundary target

A **transition** trying to land inside a section its source does not belong to.
Rejected, with the section itself suggested instead: entering a container means
entering it at the top.

A transition may reach a root node, a sibling, or an ancestor. This is the one
place the design chooses readability over configurability, and it keeps both the
graph legible and the interpreter tractable.

### Context

The typed data a workflow instance carries, and the input to every **guard**
evaluation. Its shape is declared in the document, which is what makes a value
written into it checkable (I4).

_Not:_ application state. Anything wider than this workflow belongs to a state
management library, which Leyline is not (brief §4).

### Surface

A declaration of semantic UI intent attached to a node — `form`, `datatable`,
`metric-panel`, `link`, `text` in v1. A surface says _what this is for_, never
what it looks like or where it sits.

_Not:_ a component, and not a layout primitive. A schema able to express "a row
of two columns" has become a worse HTML and has failed (brief §4).

_Defined in:_ `packages/schema/src/surface.ts`. Governed by
[decision 0016](decisions/0016-minimum-surface-set.md).

### Surface type

Which semantic intent a surface declares. The set is deliberately tiny, because
every type added becomes a permanent obligation for every **renderer registry**
anyone ever writes. A sixth type needs two independent real workflows that want
it and a recorded decision.

The type is an open string rather than an enum: a build meeting an unknown type
must fall back rather than refuse the document (AD8), which it cannot do if
parsing already failed.

### Transition

A movement from one node to another, optionally gated by a **guard**. Named
`target` plus optional `when`; both are names, never functions.

### Event transition

A transition taken when a named event arrives — the `on` array of a node.

### Invoke

A node's declaration that it performs an asynchronous **service**, with the
result optionally assigned into a **context** field and the outcome routed
through `onDone` and `onError` transitions.

### Entry node

The node a workflow instance starts at. Every other node must be reachable from
it, or validation reports `graph.unreachable-node`.

### Requirements block

The document's self-declared list of **capability** names — the `requires`
field. It exists so that **binding** can verify every name at once, up front,
and so that the set of names a document may reference is closed and readable
(G8, I2).

_Not:_ the **capability bundle**. The requirements block is the document's list
of what it needs; the bundle is the application's supply of implementations.

### Identifier

The stable, opaque handle for anything addressable — workflow, node, surface,
transition, registry entry, **change record**. Author-supplied or derived, and
never a path, a URL, or anything else with structure to exploit (AD12, I5).

_Defined in:_ `packages/schema/src/ids.ts`.

### Derived identifier

An identifier the system generates where an author supplied none, by hashing
what the thing _is_ — its type, its data source, its target — and never its
position, its guard, or its props.

That exclusion is the point: attaching a guard to a surface leaves the surface
addressable under the same identifier, so an agent that discovered it in one
call can still use it in the next. Where the identifying fields fail to separate
two siblings, validation reports `id.ambiguous` rather than guessing.

Governed by [decision 0018](decisions/0018-identifier-derivation.md).

### Fixture corpus

The reference workflows under `packages/schema/src/fixtures/`, stored in the
canonical form the parser emits. They serve three purposes: a round-trip test
that parsing changes no bytes, the acceptance benchmark from brief §2, and the
coordination point with the planned Kotlin DSL, which must emit byte-comparable
documents for the same workflows (brief §10).

### Schema version

The `leylineVersion` a document carries. Within a major version, evolution is
additive only (AD8). Distinct from the npm package version — see
[versioning.md](versioning.md).

---

## Capabilities and binding

The join between a document, which holds names, and an application, which holds
implementations (AD2).

### Capability

Something a document references by name and an application supplies by
implementation. Three kinds: **guard**, **service**, **data source**.

### Guard

A named predicate over **context**. Gates a **transition** or the presence of a
**surface**. Conditional presence is normal operation, not a special case (G7).

_Not:_ a **policy**. A guard decides what a _user_ sees or may do next, from
workflow state. A policy decides what an _initiator_ may change about the
workflow itself. They sit on opposite sides of the system and never substitute
for each other.

### Service

A named asynchronous operation a node invokes, whose result may be assigned into
**context**.

### Data source

A named provider of data for a **surface**, static or subscribable.

### Capability bundle

The runtime object supplying implementations for the guards, services, and data
sources a document requires. Supplied by the application, and therefore trusted
by definition — a malicious bundle is outside the threat model
([SECURITY.md](../SECURITY.md)).

### Binding

Joining a document to a bundle. Binding verifies the **requirements block**
against what the bundle supplies and fails at registration time with every gap
reported at once, rather than at click time with the first one (G8).

_Defined in:_ `CapabilityBindingError`, `packages/core/src/errors.ts`.

### Closed capability set

The rule that a document may reference only names the bound bundle already
supplies, and that binding rejects unknown names rather than ignoring them. This
is invariant **I2**, and it is what stops a document from introducing behaviour
rather than merely arranging it.

---

## The runtime

What `@leyline/core` exposes. Headless: zero framework dependencies, testable
with no DOM (G4).

### Store contract

The subscription interface every framework adapter bridges: `getSnapshot()`,
`subscribe(listener)`, `send(event)`. Proven in libraries like TanStack Query
and Table, and the reason adding a framework is small work (AD4).

### Snapshot

The immutable current state an adapter reads: current node, **context**,
**resolved surfaces**, status. Immutable with structural sharing, so identity
comparison is a valid change check and no equality function is needed.

_Not:_ **context**. Context is the data the workflow carries; the snapshot is
the whole observable state, context included.

Since [decision 0019](decisions/0019-section-nodes.md) the snapshot exposes an
**active region** tree rather than a single node, because a **section** in
`many` **mode** has several children active at once.

### Active region

One active node in a snapshot, with its **resolved surfaces** and whatever is
active beneath it. A leaf node is the same shape with no children, so an adapter
handles one structure rather than two.

`children` holds only what is currently active: every child of a `many` section,
the one active child of a `one` section, in **reading order**.

_Defined in:_ `packages/core/src/contracts.ts`, with `walkRegions` and
`activeSurfaces` for traversal.

### Resolved surface

A surface as it appears in a snapshot: its **guard** already evaluated, its
**data source** already attached. A renderer receives a ready-to-render list and
contains no conditional workflow logic (AD6).

### Prop-getter

A framework-neutral function on the snapshot returning props an adapter spreads
onto a native element — table sorting, row selection, focus management. The core
ships behaviour this way and never ships components (AD7, after Zag.js).

### Adapter

A package bridging the **store contract** to one framework's reactivity:
`@leyline/react`, `@leyline/svelte`, `@leyline/vanilla`. Adapters stay thin;
logic appearing in two of them belongs in the core instead (G5).

### Engine facade

The internal interface hiding the statechart implementation. XState runs behind
it, and neither the public API nor the schema ever exposes XState types or
concepts, which keeps the option of replacing it later (AD3).

_Defined in:_ `packages/core/src/engine/`, the only directory permitted to name
XState. Both a lint rule and the CI **boundary check** enforce that.

### Runtime mode

`development` or `production`, named explicitly at construction and never
inferred. In production with no **policy** configured, changes from an **agent**
initiator are denied, and **redaction** defaults to hiding all context values.

---

## Rendering

How semantic intent becomes something on screen. None of it lives in the core.

### Renderer

A framework component registered to draw a given kind of **surface**. Authored
in application code as ordinary React or Svelte; Leyline makes the result
registrable and discoverable, and generates nothing itself (brief §4).

### Renderer registry

An ordered, ranked set of predicates mapping surfaces to renderers. Swapping the
registry restyles the application without touching any workflow document (G6).

### Ranked resolution

Resolving a surface by asking ranked predicates rather than reading a flat type
map. A generic `datatable` renderer can be overridden by a higher-ranked one
claiming a single specific table — which is exactly how "swap the actions table
for a card grid" happens without editing a document (AD5, after JSON Forms).

### Rank

The integer deciding which claim wins. Higher wins.

### Fallback renderer

What a registry draws for a surface nothing claimed. Leyline logs and renders
the fallback; it never throws. This is what lets a deployed build read a
document containing surface types it has never heard of (AD8).

---

## The control plane

The single interface through which registries and workflows change (AD10). One
path for application code, a developer at a REPL, a devtools panel, and an AI
agent alike — same power, same checks, no back door.

### Change

A serializable description of a proposed mutation: register a renderer, attach a
guard to a surface, replace a workflow, patch context. Pure data — it can name a
renderer, never define one (I1, I3).

_Defined in:_ `packages/schema/src/changes.ts`.

### Proposal

A change plus the **initiator** claiming it and a **correlation ID**. Proposals
are data, so applying the same validated proposal twice is a no-op with a clear
result, and a session's proposals can be recorded and replayed elsewhere.

### Propose, validate, apply, revert

The four-phase protocol every mutation follows (AD11). **Propose** describes it;
**validate** checks it against current state and returns structured issues;
**apply** commits it atomically and produces a **change record**; **revert**
undoes an applied change by identifier, replaying later changes against the
restored state.

### Dry run

Propose and validate without applying — a first-class operation, and what agents
are expected to do before applying anything.

### Change record

The durable result of an apply: its identifier, the change, the initiator, when
it happened, and what reverted it if anything did.

_Not:_ a **change**. The change is the request; the record is what happened.

### Change log

The ordered record of applied changes, supporting revert. Derived from `apply`
and `revert` **trace events** rather than maintained beside them, so the audit
trail and the observability stream can never disagree (AD15).

### Policy

The application-supplied function receiving every proposal and its initiator,
returning allow, deny, or require-confirmation. This is where an application
decides that agents may swap renderers but not modify guards, or may modify
guards in staging but not production (AD13).

Consulted before validation, apply, and revert alike, with no operation
exempt — including operations initiated by application code. That is invariant
**I6**.

_Not:_ a **guard**. See the distinction under [Guard](#guard).

### Initiator

The identity attached to a change: `application`, `developer`, or `agent`, with
an optional label. Recorded in the log and available to policy.

Self-asserted and advisory in v1 — the transport, not Leyline, is where stronger
identity belongs, and the policy hook is the documented place to enforce it
(OQ7).

`user` means an end user rearranging their own view of an application that chose
to offer that. It exists separately from `application` so that **policy** can
tell them apart: an application may change anything, a viewer typically only
their own presentation.

### Personalization

An end user reshaping their own view — reordering a **section**'s children,
moving a region to a different container, choosing among the **renderers** an
application published, hiding a **surface**.

Expressed as ordinary **changes** through the **control plane**, not as a
separate subsystem. A viewer rearranging a page and an agent swapping a table
travel the same path, meet the same **policy**, produce the same **change
record**, and revert the same way — so "reset my layout" is a revert rather than
a feature.

A viewer never writes arrangement. They reorder semantic containers and pick
from what the application made **discoverable**, which keeps the document free
of layout and keeps the reachable presentations bounded by what the application
chose to offer.

Governed by [decision 0020](decisions/0020-personalization.md).

### Operation descriptor

A self-describing definition of one control-plane operation: name, description,
input schema, output schema. Maps directly onto tool and function-calling
formats and onto MCP tool definitions, which is what makes the control plane
usable by an agent with no bespoke integration.

### Describe

The introspection call returning the workflow, its nodes, its surfaces, the
registries, and the capabilities — with human-readable descriptions alongside
identifiers, so an agent can reason about "the table of available actions on the
workspace hub" without a developer explaining the schema first.

---

## Observability

One ordered stream carries everything observable (AD15). Devtools, log
aggregators, and agents confirming their own effects all read the same events.

### Trace event

One small structured message on that stream: a fixed envelope — `ts`, `seq`,
`kind`, `correlationId`, `initiator` — plus a kind-specific `data` payload.

Payloads reference things by **identifier** rather than embedding them; a
consumer wanting the whole object asks the control plane. A few hundred bytes is
the working ceiling.

_Defined in:_ `packages/schema/src/trace.ts`, published as JSON Schema so a log
line, an MCP result, and a devtools panel speak one format.

### Trace kind

What an event reports: a transition, a guard evaluation, a service invocation, a
snapshot publication, a proposal, a policy decision, an apply, a revert. Open as
a string, because an unknown kind is data a later build emits, not a fault.

### Correlation ID

The identifier shared by every event in one causal chain — a user event and
everything it triggered, or a proposal and everything that happened to it. This
is what lets a developer reconstruct causality from the stream alone.

### Sink

A consumer attached to the stream: the built-in bounded ring buffer, the console
sink, an OpenTelemetry bridge, or one an application writes. With no sink
attached, emission is a guard check that allocates nothing.

### Ring buffer

The built-in bounded in-memory sink backing `recent()`, devtools, and tests. The
core never buffers unboundedly on behalf of a consumer that is not there.

### Redaction hook

The function applied to every payload before any sink sees it. Context values
may hold sensitive data; the default redacts nothing in development and all
context values in production unless an allow-list is supplied.

---

## Validation and reporting

### Issue

One structured finding: a **severity**, a **rule**, the path into the offending
document, the **identifier** at fault, a message, and where possible a suggested
fix. Validation issues, binding failures, and rejected changes all use this one
shape, so a log line, an MCP tool result, and a devtools panel need no
translation.

_Defined in:_ `packages/schema/src/issues.ts`.

### Severity

`error` or `warning`. Structure is an error; unknown vocabulary is a warning.
A finding that breaks the graph blocks; a finding that only means "this build is
older than this document" informs.

Governed by
[decision 0017](decisions/0017-structure-errors-vocabulary-warnings.md).

### Rule

The machine-readable name of what was violated — `graph.dangling-target`,
`capability.undeclared`, `id.ambiguous`. An agent branches on the rule rather
than parsing the message. The full catalogue lives in the
[`@leyline/schema` README](../packages/schema/README.md#validation).

### Normalization

The pass filling in **derived identifiers** where an author supplied none, and
reporting ambiguity where derivation cannot separate two siblings.

### JSON Schema artifact

The contract exported from the Zod definitions and published under
`packages/schema/schema/` — one file per contract, versioned, carrying the real
constraints as patterns rather than a lossy approximation (AD9).

It exists so that a producer in another language, or an agent generating
documents directly, validates against the same rule this build enforces. A drift
test compares the committed files against the export function.

### Additive evolution

The rule that within a major **schema version**, documents only gain fields, and
a consumer meeting an unknown node kind or surface type degrades through a
**fallback renderer** rather than failing (AD8). It is what lets a deployed
application read a document written for a later minor version.

---

## The security boundary

The full threat model, with the attacker capabilities assumed and what stays out
of scope, lives in [SECURITY.md](../SECURITY.md). These are the terms it uses.

### Invariant

One of the seven properties (**I1**–**I7**) that make the schema a verified
security boundary rather than a design preference (AD14). Each carries a test
suite that _attempts to violate it_, and those suites gate merges.

### Inert

Carrying no executable meaning. A document is inert: parsing and validating one
has no side effects, and no field is ever evaluated, constructed as a function,
dynamically imported, or read as an expression language (**I1**).

**Context** values written by an initiator are inert too — nothing in the core,
the adapters, or the agent package reads one as an identifier, a path, a URL, or
code (**I4**).

### Opaque

Carrying no structure an initiator could exploit by construction. Identifiers
are opaque: content-derived ones use a hash rather than a concatenation, and
nothing in one is a path or a URL (**I5**).

### Hygiene

The parsing defenses against prototype pollution: keys such as `__proto__`,
`constructor`, and `prototype` rejected at validation and dropped during parsing,
at any depth (**I7**).

### Discoverable

The property a **renderer** must already have before the control plane will
register it. An initiator can name a renderer the application made discoverable;
it can never supply one (**I3**). The metadata contract for advertising a
renderer is OQ3.

### Trusted by definition

Inside the boundary and not defended against: the **capability bundle** the
application supplies, the renderers it makes discoverable, and the transport
carrying MCP traffic. Naming these explicitly is what keeps the threat model
honest about its own edges.

---

## Project conventions

### Architectural decision (AD)

One of the settled decisions AD1–AD15 from brief §5, plus everything recorded
since in [`docs/decisions/`](decisions/). A specification implements them rather
than reopening them, unless implementation surfaces a concrete blocker — which
gets recorded as a superseding decision.

### Goal (G)

One of the ten goals in brief §3. Referenced as G1–G10 where a piece of code
exists to serve one.

### Open question (OQ)

One of the questions in [open-questions.md](open-questions.md) that
specification still has to settle, each with a suggested starting point and the
stage that decides it. Closing one produces a decision record.

### Delivery stage

One of the seven stages in [roadmap.md](roadmap.md), each producing a working,
tested artifact with stated exit criteria.

### Constitution

[constitution.md](constitution.md) — the obligations every change answers to,
and the definition of done a reviewer holds a pull request to.

### Boundary check

`scripts/check-boundaries.mjs`, which walks workspace manifests and fails if a
framework-free package reaches a UI framework directly or transitively, or if
anything but `@leyline/core` names the statechart engine. Run in CI beside a
lint rule doing the same job at import level, because a manifest can declare a
dependency no source file has imported yet.

### Adversarial test

A test that attempts to violate an **invariant** rather than confirming it
holds. A change to the schema or the control plane arriving without one does not
merge, and CI runs these as a separate required gate.

### Framework-free

The property of `@leyline/schema`, `@leyline/core`, `@leyline/dsl`,
`@leyline/agent`, and `@leyline/vanilla`: no dependency on any UI framework,
direct or transitive, enforced by the **boundary check**.

---

## Where things live

| Package                                                 | Holds                                                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@leyline/schema`                                       | The document definitions, validation, identifiers, change and trace vocabulary, JSON Schema artifacts |
| `@leyline/core`                                         | Interpreter, store, binding, registries, control plane, change log, policy, trace stream              |
| `@leyline/dsl`                                          | The TypeScript builder that emits documents                                                           |
| `@leyline/agent`                                        | Introspection, operation descriptors, MCP adapter                                                     |
| `@leyline/react`, `@leyline/svelte`, `@leyline/vanilla` | Adapters bridging the store contract                                                                  |
| `@leyline/devtools`, `@leyline/otel`                    | Post-v1: inspector and OpenTelemetry sink                                                             |

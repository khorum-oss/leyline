# Architecture

Diagrams for the shape the brief describes. Each one covers a mechanism that
prose alone leaves ambiguous; the reasoning behind every choice lives in
[`project-brief.md`](project-brief.md) §5, and the obligations they create live
in [`constitution.md`](constitution.md).

## Packages and dependency direction

Arrows point from a package to what it depends on. The framework-free set is a
CI gate, not an aspiration: `scripts/check-boundaries.mjs` walks manifests
transitively and an ESLint rule guards imports.

```mermaid
flowchart TB
    subgraph free["Framework-free — enforced by lint rule and CI boundary check"]
        direction LR
        DSL["@leyline/dsl<br/>builder"]
        SCHEMA["@leyline/schema<br/>Zod · JSON Schema export"]
        CORE["@leyline/core<br/>interpreter · store<br/>control plane · trace"]
        AGENT["@leyline/agent<br/>descriptors · MCP"]
        VANILLA["@leyline/vanilla<br/>DOM adapter"]
    end

    subgraph bound["Framework-bound"]
        direction LR
        REACT["@leyline/react"]
        SVELTE["@leyline/svelte"]
    end

    DSL --> SCHEMA
    CORE --> SCHEMA
    AGENT --> SCHEMA
    AGENT -. peer .-> CORE
    VANILLA -. peer .-> CORE
    REACT -. peer .-> CORE
    SVELTE -. peer .-> CORE
```

Only `@leyline/core` may name the statechart engine, and only inside
`src/engine/` (AD3). Everything else in the core depends on the facade
interface, which keeps the option of replacing XState with a smaller purpose-built
interpreter later.

## What a document becomes at runtime

A schema document carries names, never functions (AD2). Binding is where names
meet implementations, and where a mismatch surfaces — at registration time, with
every gap reported at once, rather than at click time (G8).

```mermaid
flowchart LR
    DOC["Schema document<br/>names only"]
    BUNDLE["Capability bundle<br/>guards · services · data sources"]
    BIND{"Binding<br/>verifies requirements"}
    ERR["CapabilityBindingError<br/>every gap, each with a path"]
    INT["Interpreter<br/>behind the statechart facade"]
    SNAP["Snapshot<br/>node · context<br/>resolved surfaces · status"]
    ADAPT["Framework adapter<br/>bridges the store contract"]
    REG["Renderer registry<br/>ranked predicates"]
    COMP["Components"]
    TRACE[("Trace stream")]

    DOC --> BIND
    BUNDLE --> BIND
    BIND -- "missing name" --> ERR
    BIND -- "verified" --> INT
    INT --> SNAP
    SNAP --> ADAPT
    ADAPT --> REG
    REG --> COMP
    COMP -- "send(event)" --> INT
    INT --> TRACE
```

Two properties of that path carry weight:

- Guards are already evaluated and data sources already attached by the time a
  surface reaches a renderer (AD6). A renderer holds no conditional workflow
  logic; it receives a ready-to-render list.
- An unresolvable surface renders a registered fallback and logs. It never
  throws, which is what lets a deployed application read a document written
  against a later minor version (AD8).

## Ranked renderer resolution

A flat type map cannot express "this specific table looks different". Ranked
predicates can, and the highest-ranked claim wins (AD5).

```mermaid
flowchart TB
    S["Surface<br/>type: datatable<br/>id: actions"]
    R80{"rank 80<br/>claims id = actions"}
    R50{"rank 50<br/>claims type = datatable"}
    R0{"rank 0<br/>fallback"}
    CARD["CardGrid"]
    TABLE["DataTable"]
    UNKNOWN["Fallback renderer<br/>renders and logs"]

    S --> R80
    R80 -- "claims" --> CARD
    R80 -- "declines" --> R50
    R50 -- "claims" --> TABLE
    R50 -- "declines" --> R0
    R0 --> UNKNOWN
```

An agent swapping the actions table for a card grid registers a renderer at a
higher rank. Nothing about the workflow document changes, and reverting removes
the registry entry.

## The control plane: propose, validate, apply, revert

One mutation path serves application code, a developer at a REPL, devtools, and
an agent alike (AD10). Policy runs first and nothing skips it — not revert, not
application code (I6).

```mermaid
sequenceDiagram
    autonumber
    participant I as Initiator
    participant CP as Control plane
    participant P as Policy hook
    participant V as Validator
    participant S as State
    participant T as Trace stream

    I->>CP: propose(change, initiator)
    CP->>T: control.proposed
    CP->>P: decide(proposal)
    P-->>CP: allow / deny / confirm
    CP->>T: control.policy

    alt denied
        CP-->>I: structured refusal with reason
    else allowed
        CP->>V: validate(proposal)
        V-->>CP: ok, or issues with path and identifier
        CP->>T: control.validated
        opt dry run
            CP-->>I: validation result only
        end
        CP->>S: apply(proposal)
        S-->>CP: new immutable state
        CP->>T: control.applied
        CP-->>I: change record with a stable id
    end

    Note over I,T: revert(changeId) repeats the same path,<br/>policy included, and replays later changes
```

Every proposal, its policy decision, its validation, and its apply share one
correlation ID, so the causal chain reconstructs from the stream alone.

## One stream, two readers

Everything observable flows through a single emitter (AD15). The change log
projects from that stream rather than living beside it, so the audit trail and
the observability data cannot disagree.

```mermaid
flowchart LR
    subgraph sources["Emitters"]
        direction TB
        TR["transitions"]
        GU["guard evaluations"]
        SV["service invocations"]
        SN["snapshot publications"]
        CPE["proposals · policy<br/>validations · applies · reverts"]
    end

    EM(("Trace emitter<br/>ordered, sequenced"))
    RED["Redaction hook<br/>runs before any sink sees a payload"]
    RING["Ring buffer sink<br/>bounded, in-memory"]
    CON["Console sink"]
    OTEL["@leyline/otel<br/>post-v1"]
    LOG["Change log<br/>projection of apply + revert"]
    DEV["Devtools · agents<br/>observing their own effects"]

    TR --> EM
    GU --> EM
    SV --> EM
    SN --> EM
    CPE --> EM
    EM --> RED
    RED --> RING
    RED --> CON
    RED --> OTEL
    RING --> LOG
    RING --> DEV
```

With no sink attached, emission costs a guard check and allocates nothing. Events
stay small — an envelope plus identifiers, a few hundred bytes as the working
ceiling. Anything larger goes through the control plane instead.

## The motivating scenario as a graph

Brief §2 is the acceptance benchmark: a design that cannot express this cleanly
has failed. Guards appear on transitions and on surface presence alike (G7).

```mermaid
stateDiagram-v2
    direction LR
    [*] --> CreateWorkspace

    CreateWorkspace: Create workspace (step)
    CreateWorkspace: invoke createWorkspace

    Billing: Management / billing (step)
    Billing: invoke submitBilling

    Hub: Workspace hub
    Hub: datatable · metric-panel · links

    ActionTwo: Action two (step)
    ActionThree: Action three (step)

    CreateWorkspace --> Billing: isPaidTier
    CreateWorkspace --> Hub: free tier
    Billing --> Hub
    Hub --> ActionTwo: link present<br/>only when canRunActionTwo
    Hub --> ActionThree
    ActionTwo --> Hub
    ActionThree --> Hub
```

The hub's surfaces carry their own guards, so the _Action Two_ link appears and
disappears as context changes, with no page reconstruction. The agent extension
of the scenario — swapping the actions table for a card grid, and hiding the
metrics panel for free-tier workspaces — reaches the same graph through the
control plane, changing a registry entry in the first case and attaching a guard
to a surface in the second.

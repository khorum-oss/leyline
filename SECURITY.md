# Security

## Reporting a vulnerability

Report privately through GitHub's security advisory form on this repository
rather than opening a public issue. Expect an acknowledgement within a few
working days.

## Threat model

Leyline exists so that an AI agent can reshape a running application's workflow
and presentation through a structured interface. That capability defines the
threat.

**The party defended against.** An initiator — typically an AI agent, possibly a
compromised one, possibly one following instructions injected into content it
read — who can submit arbitrary schema documents and arbitrary change
descriptions to the control plane.

**What that party must never gain.** Execution of code they supplied, or data
access beyond what the capability bundle already grants to the application
itself. An agent may reference a guard; it may never introduce one. An agent may
swap a renderer the application already made discoverable; it may never supply a
component.

**Trusted by definition, and therefore out of scope:**

- The capability bundle the application supplies. A malicious guard or service
  in that bundle sits inside the trust boundary; Leyline cannot and does not
  defend against it.
- Renderers the application registers as discoverable. Making a renderer
  discoverable is the application's decision to trust it.
- The transport carrying MCP traffic, and whatever authenticates it. Initiator
  labels reach Leyline self-asserted and advisory (OQ7); the policy hook is the
  documented place to enforce anything stronger.
- The host application's own bugs, its network, and its browser.

## Invariants

Each invariant carries a test suite that attempts to violate it. Those suites
gate merges: a change to the schema or the control plane arriving without a
corresponding adversarial test does not merge.

### I1 — No executable content in schema or change documents

Parsing and validating a document has no side effects. No field reaches `eval`,
`new Function`, a dynamic `import`, or an expression interpreter. Guards,
services, data sources, and renderers are referenced only by opaque string
identifiers resolved against registries the initiator does not control.

_Enforced by:_ lint rules banning `eval` and `new Function` across the
workspace; adversarial tests submitting documents whose fields carry code-shaped
strings and asserting that nothing evaluates.

### I2 — Closed capability set

A document may reference only capability names the bound bundle already supplies.
It cannot introduce a guard, service, or data source. Binding rejects unknown
names rather than ignoring them, and reports every one of them at once.

_Enforced by:_ `CapabilityBindingError` at binding time; adversarial tests
binding documents that name capabilities the bundle lacks.

### I3 — Renderer registration is capability-gated

A change registering a renderer may name only a renderer the application already
made discoverable. An initiator cannot supply component code through the control
plane. The registration metadata contract that makes a renderer discoverable is
OQ3.

### I4 — Context is data, not a channel

Values an initiator writes into context through change descriptions get
validated against the workflow's declared context shape and stay inert. Nothing
in the core, the adapters, or the agent package interprets a context value as an
identifier, a path, a URL, or code.

### I5 — Identifiers are opaque

Stable identifiers carry no path, URL, or structural meaning exploitable by
construction. Content-derived identifiers use a hash, not a concatenation, and
length-prefix their inputs so no arrangement of delimiters inside one part can
imitate a different set of parts.

_Enforced by:_ `@leyline/schema/src/ids.ts` and its adversarial tests.

### I6 — Policy is consulted first and cannot be bypassed

Every proposal reaches the policy hook before validation, apply, or revert. No
control-plane operation skips it — not revert, and not operations initiated by
application code. In production mode with no policy configured, an agent
initiator gets denied.

### I7 — Prototype and injection hygiene

Documents parse with prototype-pollution defenses. Keys such as `__proto__`,
`constructor`, and `prototype` get rejected at validation and dropped during
parsing, at any depth. Renderer predicates receive frozen surface descriptors.

_Enforced by:_ `@leyline/schema/src/hygiene.ts` and its adversarial tests.

## Status

Invariant coverage tracks the delivery sequence. I5 and I7 ship with the schema
foundation; I1–I4 and I6 ship with the core runtime and control plane in stage
2, which is where each gets its dedicated adversarial suite. This document gets
reconciled against the shipped suites in stage 7, and any gap between the two
counts as a defect in the suites rather than a relaxation here.

# 0031. An initiator label is advisory; attestation is a fact about the connection

- **Status:** accepted
- **Date:** 2026-09-10
- **Closes:** OQ7

## Context

Anyone calling the control plane says who they are, and nothing has checked it.
For a developer at a REPL that is exactly right. For an MCP connection in a
shared staging environment it is a string an agent chose about itself, and
policy has been asked to make decisions on it.

Two answers were available and both are wrong on their own. Treating the label
as trustworthy is false. Ignoring identity entirely leaves a host that _does_
authenticate its connections with nowhere to put the result, so every such host
invents its own convention and policy cannot rely on any of them.

## Decision

**The label stays advisory.** It is self-asserted, recorded as-is, and passed to
policy. Leyline makes no claim about it.

**Attestation is separate, and a caller cannot supply it.** An initiator may
carry `attested: { subject, via }` — who the transport authenticated, and how,
in the host's own vocabulary. Whatever sits between an untrusted caller and the
control plane attaches it from the connection it already authenticated, and
discards anything the caller sent in its place.

In `@leyline/agent` that boundary is the surface. It is constructed with the
identity and attestation the host decided, and neither is readable from a tool
call: `leyline_propose` takes a change and nothing else. A caller cannot relabel
itself between one call and the next, and an attestation it repeats back is just
a string in a field the surface overwrites.

**Policy is the enforcement point.** Requiring attestation is one line:

```ts
const policy = (proposal) =>
  proposal.initiator.kind === 'agent' && proposal.initiator.attested === undefined
    ? { effect: 'deny', reason: 'Changes are accepted only over an authenticated connection.' }
    : { effect: 'allow' };
```

## Consequences

The distinction is legible in the audit trail. A change record shows both what
the initiator called itself and what, if anything, the connection proved —
which is the difference between "an agent labelled card-grid-swap" and "a
connection authenticated as svc_reviewer".

Nothing about this is enforced by the core, and that is the point: whether an
attestation is required depends entirely on the deployment. A headless Node
instance has no transport at all, and demanding one there would be nonsense.

The guarantee is only as good as the surface attaching it. That surface is
inside the trust boundary by definition (`SECURITY.md`), the same way the
capability bundle is.

## Alternatives considered

**Require attestation in production.** Rejected: it makes the core responsible
for a decision that depends on the deployment, and breaks the headless case
where there is no transport to attest anything.

**Purely advisory, nothing carried.** Rejected: a host that authenticates its
connections then has nowhere to record it, so policy can only ever see a string
the caller chose.

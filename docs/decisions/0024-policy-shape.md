# 0024. Policy is one predicate, with combinators

- **Status:** accepted
- **Date:** 2026-09-10
- **Closes:** OQ2

## Context

AD13 puts a policy hook on the control plane without saying what shape it takes.
Decision 0020 raised the stakes: an application offering personalization needs
"viewers may reorder their own regions, and may never touch a guard" to be easy
to write and hard to get wrong.

## Decision

`(proposal) => allow | deny | confirm`, synchronous or asynchronous, receiving
the whole proposal including the initiator.

Shipped combinators cover what recurs: `permissive`, `denyAll`, `allowKinds`,
`denyKinds`, `forInitiator`, `requireConfirmation`, `allOf`, `anyOf`.

`allOf` takes the strictest answer — any denial denies, and short of that any
confirmation requirement stands. That is the only composition rule which cannot
be used to weaken a policy by adding another one to it.

With no policy configured, development is permissive and production denies both
`agent` and `user` initiators. Both are identities whose authority an
application grants deliberately; defaulting them open would make the safe
configuration the one you have to remember.

## Consequences

A single function can express any rule, so no requirement ever hits a wall that
sends everyone back to code anyway.

Policy is not serializable, so it cannot be inspected by an agent or reviewed as
configuration. A `fromRules(table)` combinator could add that later without
changing the contract, which is why the contract is the predicate rather than
the table.

## Alternatives considered

**A declarative rule table.** Rejected for now: it needs its own schema,
evaluation order, and conflict rules, and the first requirement it cannot
express undoes the benefit.

# 0027. Confirmation is a pending proposal

- **Status:** accepted
- **Date:** 2026-09-10
- **Closes:** OQ4

## Context

AD13 lets a policy return "require confirmation" without saying what happens
next. Building the control plane without an answer would have meant shipping a
documented effect that did not do what it said.

## Decision

A proposal whose policy returned `confirm` becomes **pending**. It is listable
through `pending()` and resolved by identifier: `confirm(id)` opens it for
apply, `cancel(id)` refuses it for good. `validate()` reports the requirement as
a warning carrying the policy's reason and both call signatures.

Nothing blocks. A pending proposal that is never resolved simply expires
unapplied.

## Consequences

The same mechanism serves a human clicking a dialog and an MCP client polling,
without the control plane knowing which it is talking to — which is the property
G9 asks for.

A stuck confirmation is visible: it sits in `pending()` where anyone can see it,
rather than inside a promise nobody can inspect.

The application supplies whatever asks the question. Leyline surfaces the
pending state and stays out of it.

## Alternatives considered

**An application-supplied async callback the policy awaits.** Rejected: it
blocks the operation on a promise the caller cannot inspect, suits MCP poorly,
and makes a stuck confirmation invisible.

**Treat `confirm` as `deny` until stage 4.** Rejected: a documented effect that
does not do what it says gets discovered by whoever first relies on it.

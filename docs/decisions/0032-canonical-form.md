# 0032. Canonical form is the authored document, not the normalized one

- **Status:** accepted
- **Date:** 2026-09-10

## Context

Stage 1 defined the fixture corpus as "the canonical form the parser emits" and
left canonical form a convention rather than a function. The DSL made the
convention ambiguous, because two documents have a claim to being canonical:

- what `parseWorkflow` returns — the document as written, with key order
  normalized to the schema's shape;
- what `validateWorkflow` returns — that, plus every identifier the author left
  out, derived and filled in (AD12).

The first DSL emission used the second, and was not byte-identical to the
hand-written fixture. The fixture had no transition identifiers in it; the DSL
output had nine.

## Decision

**Canonical form is the parsed document.** Identifiers an author left out stay
left out.

`serializeWorkflow(document)` in `@leyline/schema` is that form as text: known
fields in schema order, unknown fields after, two-space indentation, trailing
newline. It is a published function rather than a convention, because the
fixture corpus is a contract two authoring languages are held to (brief §10) and
a contract needs an implementation.

A derived identifier is derived. Storing one duplicates what the document
already implies, and makes every stored file churn the day derivation changes —
which decision 0018 already anticipated by excluding presentation from the hash.
Normalization stays where it was: at load, in the runtime, every time.

## Consequences

DSL output is byte-identical to what somebody would have typed, which is what
made the equivalence testable at all. AD1's claim — that hand-written JSON and
DSL output are the same artifact rather than two descriptions that agree — is
now an assertion rather than an aspiration.

The Kotlin track gets a function to compare against instead of a paragraph
describing one.

Anything that wants identifiers filled in calls `validateWorkflow`, which is
what the runtime already does.

## Alternatives considered

**Store the normalized form.** Rejected: the artifact would carry information it
implies, and a change to derivation would rewrite every file in every repository
using Leyline.

**Leave canonical form a convention.** Rejected: it was already ambiguous enough
to produce a failing test the first time two producers existed.

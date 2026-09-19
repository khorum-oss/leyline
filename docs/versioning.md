# Versioning

Two version numbers move independently, and confusing them causes real damage.

See [schema version](glossary.md#schema-version) and
[additive evolution](glossary.md#additive-evolution) in the glossary for the
short definitions; this document holds the policy.

## Schema document version

Carried by every document as `leylineVersion`, and owned by `@leyline/schema`.

Within a major version, evolution stays additive (AD8):

- New optional fields may appear.
- New node kinds and surface types may appear.
- No field changes meaning, changes type, or disappears.
- No field becomes required that was optional.

A consumer meeting an unknown node kind or surface type renders the registered
fallback and logs; it does not throw and it does not discard the document. That
tolerance is what lets a deployed application read a document written against a
later minor version — the version-skew problem that server-driven UI practice
solved this way.

A major bump means a document written for the old version no longer parses. Such
a bump arrives with a migration path and a documented reason, never as a side
effect of a refactor.

### What a consumer does with a version it does not recognise

`isSupportedSchemaVersion` is the check, and `SUPPORTED_MAJOR_VERSIONS` names
what this build reads. A newer **minor** version stays readable — that is what
additive means. A different **major** is refused rather than guessed at.

Unknown vocabulary inside a readable document is a warning, never an error
([decision 0017](decisions/0017-structure-errors-vocabulary-warnings.md)): the
document validates, the parts this build understands run, and the parts it does
not draw the fallback renderer and report `surface.unresolved`. The
[migration guide](guides/migration.md) covers what an application does about it.

### The exported JSON Schema is a published artifact

The JSON Schema exported from the Zod definitions (AD9) ships as a versioned,
published artifact rather than an internal detail. Agents generating documents
directly and the planned Kotlin DSL (brief §10) both validate against it, and
both are entitled to a stable URL and a changelog.

It carries the real constraints rather than a description of them — identifier
and version rules travel as `pattern` — and the test suite compares the committed
artifacts against a fresh export, so a Zod change that does not regenerate them
fails the build instead of shipping a contract that disagrees with the code.

## Package versions

The `@leyline/*` packages version together through Changesets (`fixed` in
`.changeset/config.json`). A release therefore never pairs a schema package with
a runtime that reads a different contract.

Package versions follow semver against the TypeScript and JavaScript API. A
schema document version bump does not force a package major, and a package major
does not imply a document version change; the two answer different questions.

### What semver covers

It covers the documented TypeScript and JavaScript API of each package: exported
functions, their parameter and return types, the store contract, the change
vocabulary, and the trace envelope.

It does not cover anything reached by going around that API. Three things are
explicitly internal, and a change to any of them is not a breaking change:

- **`src/engine/`.** The only directory permitted to name XState (AD3), and none
  of its types or concepts appear in the public API. Replacing the interpreter
  is a design option this keeps open.
- **The shape of a derived identifier.** Derived identifiers are stable within a
  major version and opaque by contract (I5). Parsing one is not a supported use,
  and neither is depending on the hash.
- **Trace payload fields beyond the envelope.** `ts`, `seq`, `kind`,
  `correlationId`, and `initiator` are the contract. A `data` payload may gain
  fields, and an unknown `kind` is data a later build emits, not a fault.

## Deprecation

A deprecated API keeps working for at least one minor release, carries an
`@deprecated` TSDoc tag naming its replacement, and emits nothing at runtime —
warnings belong on the trace stream, where a sink can decide what to do with
them.

Nothing is removed in a minor release, including something deprecated in that
same release. Removal waits for the next major, which is what makes the
`@deprecated` tag a schedule rather than a threat.

## The first release is 1.0.0

The packages do not pass through a 0.x line, and the reason is structural rather
than a claim about confidence. The adapters take `@leyline/core` as a peer
dependency; Changesets majors a peer-dependent whenever its peer releases; and
`fixed` grouping spreads that major across all seven packages. On a 0.x line
`^0.1.0` does not cover `0.2.0`, so every runtime minor would escalate into a
major for everything. Above 1.0.0 it does not, which is what makes an ordinary
minor release possible at all. [`releasing.md`](releasing.md) holds the detail
and the Changesets setting that depends on it.

So the promise above is the promise from the first published version: the
documented API is stable within a major, the three internal things named in this
document stay outside it, and a breaking change arrives as a major with the
deprecation schedule that precedes it.

The schema document version is a separate `1.0.0` governed by the rules at the
top of this document — a document you write today is one this project has
committed to reading.

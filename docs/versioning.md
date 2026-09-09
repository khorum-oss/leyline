# Versioning

Two version numbers move independently, and confusing them causes real damage.

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

### The exported JSON Schema is a published artifact

The JSON Schema exported from the Zod definitions (AD9) ships as a versioned,
published artifact rather than an internal detail. Agents generating documents
directly and the planned Kotlin DSL (brief §10) both validate against it, and
both are entitled to a stable URL and a changelog.

## Package versions

The `@leyline/*` packages version together through Changesets (`fixed` in
`.changeset/config.json`). A release therefore never pairs a schema package with
a runtime that reads a different contract.

Package versions follow semver against the TypeScript and JavaScript API. A
schema document version bump does not force a package major, and a package major
does not imply a document version change; the two answer different questions.

## Deprecation

A deprecated API keeps working for at least one minor release, carries an
`@deprecated` TSDoc tag naming its replacement, and emits nothing at runtime —
warnings belong on the trace stream, where a sink can decide what to do with
them.

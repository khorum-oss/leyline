# Leyline Constitution

The rules every specification, plan, and pull request answers to. The brief
(`docs/project-brief.md`) explains the reasoning; this document states the
obligations. Where the two disagree, the brief wins and this document gets
corrected.

Terms used here — **surface**, **guard**, **policy**, **initiator**, **control
plane**, and the rest — are defined once in [`glossary.md`](glossary.md).

## Article I — One canonical artifact

The serializable schema document holds the truth. The TypeScript DSL, a Kotlin
DSL, a code generator, an AI agent, and a hand-written JSON file all count as
producers of that document and none of them counts as a second source of truth.

A consequence worth stating plainly: no feature may exist only in the DSL. If
the DSL can express it, the schema can express it, and a hand-written document
gets the same behaviour.

## Article II — The schema stays inert

Guards, services, data sources, and renderers appear in documents as opaque
string identifiers, resolved against registries the document's author does not
control. Nothing in a document ever reaches `eval`, `new Function`, a dynamic
`import`, or an expression interpreter.

The seven invariants in `SECURITY.md` state this as a boundary rather than a
preference. Each carries a test suite that attempts to break it, and those
suites gate merges.

## Article III — The core stays headless

`@leyline/schema`, `@leyline/core`, `@leyline/dsl`, `@leyline/agent`, and
`@leyline/vanilla` reach no UI framework, directly or transitively. A lint rule
guards imports and `scripts/check-boundaries.mjs` guards manifests; CI runs
both.

Adapters stay thin. Logic that appears in two adapters belongs in the core, and
duplicating it a second time counts as a defect report against the core rather
than an acceptable cost.

## Article IV — One mutation path

Registries and loaded workflows change through the control plane and nowhere
else. Application code holds no privilege an agent lacks. If application code
needs a mutation the control plane cannot express, the control plane gains that
operation; it does not gain a back door.

Every mutation follows propose → validate → apply → revert. Validation returns
structured issues, never a bare boolean. Dry-run stands as a first-class
operation, and agents dry-run before they apply.

## Article V — Everything observable flows through one stream

One ordered emitter carries transitions, invocations, guard evaluations,
snapshot publications, proposals, policy decisions, applies, and reverts. The
change log projects from that stream rather than living beside it, so the audit
trail and the observability data cannot disagree.

With no sink attached, emission costs a guard check and allocates nothing.
Events stay small: an envelope plus identifiers, a few hundred bytes as the
working ceiling. Anything larger goes through the control plane instead.

## Article VI — Failures arrive early and name themselves

A schema declares the capabilities it requires. Binding verifies them against
the bundle and reports every gap at once, at registration time. Missing
capabilities, dangling transition targets, unresolvable surfaces, and rejected
changes each name the path and the identifier at fault in a structure an agent
can act on.

Unresolvable surfaces render a registered fallback and log. They never throw.

## Article VII — The vocabulary stays small

Every surface type becomes a permanent obligation for every renderer registry
ever written. A new surface type needs two independent real workflows that want
it and a recorded decision in `docs/decisions/`. The same bar applies to node
kinds.

## Article VIII — Evolution stays additive

Within a major schema version, documents only gain fields. A consumer meeting an
unknown node kind or surface type degrades through a fallback. Every document
carries its version. `docs/versioning.md` holds the detail.

## Article IX — Safe by default

A Leyline instance names its mode at construction; nothing infers it. In
production mode with no policy configured, changes from an agent initiator get
denied. Development mode may default to permissive.

## Definition of done

A change lands when all of the following hold:

- `pnpm verify` passes (format, lint, boundaries, typecheck, test, build).
- Behaviour arrived with tests that would fail without it.
- A change touching the schema or the control plane arrived with an adversarial
  test naming the invariant it protects.
- Public API changes carry a changeset and updated TSDoc.
- Any decision that closes an open question got recorded in `docs/decisions/`.

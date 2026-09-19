# Changesets

Every change that alters a published package needs a changeset:

```
pnpm changeset
```

The `@leyline/*` packages version together (`fixed` in `config.json`), so the
schema version, the runtime that reads it, and the adapters that bridge it never
drift apart in a release. Schema-document versioning is a separate concern with
its own rules — see `docs/versioning.md`.

## Two settings in `config.json` that are not defaults

`privatePackages: { version: false, tag: false }` keeps the example apps out of
a release. They are private and never publish, but without this they collect
version bumps and changelogs on every release, and a release diff should show
only what ships.

`onlyUpdatePeerDependentsWhenOutOfRange: true` is the one that matters. The
adapters take `@leyline/core` as a peer dependency, and Changesets majors every
peer-dependent when its peer releases — with `fixed` grouping, that major then
lands on all seven packages, so every release touching the runtime would be a
major one. This narrows the rule to what it is for: the adapters take a major
only when the new core version actually leaves the peer range they declare.
The flag is spelled as an experimental option upstream; `docs/releasing.md`
records why it is set and what to watch for if the spelling changes.

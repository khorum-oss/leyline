# Changesets

Every change that alters a published package needs a changeset:

```
pnpm changeset
```

The `@leyline/*` packages version together (`fixed` in `config.json`), so the
schema version, the runtime that reads it, and the adapters that bridge it never
drift apart in a release. Schema-document versioning is a separate concern with
its own rules — see `docs/versioning.md`.

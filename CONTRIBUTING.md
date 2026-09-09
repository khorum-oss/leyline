# Contributing

New to the project vocabulary? [`docs/glossary.md`](docs/glossary.md) defines
every term in one place, including the distinctions that actually trip people
up — [guard versus policy](docs/glossary.md#guard), [change versus change
record](docs/glossary.md#change-record), [context versus
snapshot](docs/glossary.md#snapshot).

## Getting set up

```bash
corepack enable
pnpm install
pnpm verify
```

`pnpm verify` runs what CI runs: formatting, lint, dependency boundaries,
typecheck, tests, build. Run it before pushing and the pipeline holds no
surprises.

## Everyday commands

| Command                              | What it does                                |
| ------------------------------------ | ------------------------------------------- |
| `pnpm test`                          | Runs every package's tests once             |
| `pnpm test:watch`                    | Watches                                     |
| `pnpm --filter @leyline/schema test` | One package                                 |
| `pnpm typecheck`                     | Project-wide `tsc --build`                  |
| `pnpm lint` / `pnpm lint:fix`        | ESLint                                      |
| `pnpm format`                        | Prettier, writing                           |
| `pnpm boundaries`                    | Framework-free packages stay framework-free |
| `pnpm build`                         | Builds every package with tsup              |
| `pnpm changeset`                     | Records a release note for a change         |

Tests resolve `@leyline/*` to workspace sources through the alias map in
`vitest.shared.ts`, so no build step sits between an edit and a test run.

## Before you open a pull request

Read `docs/constitution.md`. It names the obligations a reviewer will hold the
change to; most review friction comes from a change that quietly crosses one of
them.

Three gates deserve advance attention:

1. **Dependency boundaries.** `@leyline/schema`, `@leyline/core`,
   `@leyline/dsl`, `@leyline/agent`, and `@leyline/vanilla` reach no UI
   framework, and only `@leyline/core` names the statechart engine — inside
   `src/engine` alone (AD3). Both a lint rule and
   `scripts/check-boundaries.mjs` check this.
2. **Adversarial tests.** A change to the schema or the control plane arrives
   with a test naming the invariant it protects (`SECURITY.md`, I1–I7). A change
   without one does not merge.
3. **A changeset.** Anything altering a published package's behaviour or API
   needs `pnpm changeset`.
4. **The glossary.** A change introducing a term — a surface type, a node kind,
   a trace kind, a validation rule — defines it in
   [`docs/glossary.md`](docs/glossary.md) in the same commit. The `docs` test
   project checks the vocabulary the code exports against the glossary, and
   checks that every link into it resolves.

## Adding a surface type

The highest-cost change in the project, because every renderer registry ever
written inherits the obligation. It needs two independent real workflows that
want it, and a recorded decision in `docs/decisions/`. Expect the answer to be
no.

## Commit and branch conventions

Small, focused commits with messages that say what changed and why. Branch names
carry a short topic. Pull requests describe the change against the constitution
article or delivery stage it serves.

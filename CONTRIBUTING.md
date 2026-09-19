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

| Command                              | What it does                                            |
| ------------------------------------ | ------------------------------------------------------- |
| `pnpm test`                          | Runs every package's tests once                         |
| `pnpm test:watch`                    | Watches                                                 |
| `pnpm --filter @leyline/schema test` | One package                                             |
| `pnpm typecheck`                     | Project-wide `tsc --build`                              |
| `pnpm lint` / `pnpm lint:fix`        | ESLint                                                  |
| `pnpm format`                        | Prettier, writing                                       |
| `pnpm boundaries`                    | Framework-free packages stay framework-free             |
| `pnpm build`                         | Builds every package with tsup                          |
| `pnpm bench`                         | Observation-cost benchmarks (see `docs/performance.md`) |
| `pnpm changeset`                     | Records a release note for a change                     |

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

   Put the invariant in the `describe` or `it` title — `I3` on its own, in
   parentheses or before an em dash. `tests/security.test.ts` reads those titles
   and holds `SECURITY.md` to them in both directions, so a new suite means
   adding its path to the `_Suites:_` line of the invariant it protects. A suite
   in a package the CI project filter does not list fails that test too, rather
   than silently never running.

3. **A changeset.** Anything altering a published package's behaviour or API
   needs `pnpm changeset`.
4. **The glossary.** A change introducing a term — a surface type, a node kind,
   a trace kind, a validation rule — defines it in
   [`docs/glossary.md`](docs/glossary.md) in the same commit. The `docs` test
   project checks the vocabulary the code exports against the glossary, and
   checks that every link into it resolves.
5. **A decision record, if the change settles something.** Copy
   `docs/decisions/template.md`, number it next in sequence, and add it to the
   index — `tests/decisions.test.ts` checks that every record is reachable from
   `docs/decisions/README.md`, and that a record closing an open question is
   struck through in `docs/open-questions.md` with a pointer back.

## SonarQube

The quality gate runs on every pull request. `pnpm lint` runs the rules it fails
builds over — cognitive complexity, unsafe sorts, nested conditionals, duplicate
branches — so they surface locally rather than after a push.

Those rules need type information, so package sources are linted with the
TypeScript project service. Test files sit outside the package tsconfigs and get
the untyped rules only.

Two habits keep the gate green. Keep a function under 15 cognitive complexity:
when a validator grows a branch per case, split it into one function per case
and dispatch. And give `sort` a comparator, always — the default sorts as text,
which is a bug waiting for the first array that is not strings.

## Performance claims

One is load-bearing: tracing that nobody reads costs one boolean check (AD15).
`pnpm bench` reports the number and `docs/performance.md` records a run.

A benchmark cannot gate that, because the regression it guards against — a hot
path building a payload for a stream with no reader — is a few percent, which is
noise on a CI runner. So the property is held by tests in
`packages/core/src/trace/observation-cost.test.ts`, and a new trace call site on
a hot path asks `isEnabled` before it assembles anything.

## Adding a surface type

The highest-cost change in the project, because every renderer registry ever
written inherits the obligation. It needs two independent real workflows that
want it, and a recorded decision in `docs/decisions/`. Expect the answer to be
no.

## Releasing

You do not publish from a laptop. A change carrying a changeset reaches `main`,
the release workflow opens a _Version packages_ pull request, and merging that
pull request publishes every `@leyline/*` package to npm together.

That makes the version pull request the release review — the bumps are the
compatibility claim and the changelog is what an upgrader reads — so the entry
you write in `pnpm changeset` matters more than a commit message does.
[`docs/releasing.md`](docs/releasing.md) covers the rest: the one-time npm
setup, why the first release is 1.0.0, and how to use the packages from another
project before any of it happens.

## Commit and branch conventions

Small, focused commits with messages that say what changed and why. Branch names
carry a short topic. Pull requests describe the change against the constitution
article or delivery stage it serves.

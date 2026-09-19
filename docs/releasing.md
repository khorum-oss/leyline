# Releasing

Seven packages publish to npm under the `@leyline` scope: `schema`, `core`,
`dsl`, `agent`, `react`, `svelte`, and `vanilla`. They version together (`fixed`
in [`.changeset/config.json`](../.changeset/config.json)), so a release never
pairs a schema package with a runtime that reads a different contract. A package
version is not the [schema version](glossary.md#schema-version) a document
carries — [`versioning.md`](versioning.md) holds both sets of rules and the
difference between them. The example apps are `private` and never publish.

Releases run from [`.github/workflows/release.yml`](../.github/workflows/release.yml).
Nothing reaches npm from a laptop, and nothing reaches npm without a merged pull
request.

## One-time setup

Three things, once, by someone with admin on both the npm org and the
repository.

**1. Claim the scope.** Create the `leyline` organisation at
<https://www.npmjs.com/org/create>. The free plan publishes public packages,
which is what these are — every package already carries
`publishConfig.access: public`, so nothing in the repository changes. Creating
the org is also the real availability check: no `@leyline/*` package exists on
the registry today, but only the create form proves the scope itself is free.

**2. Mint a token.** npm → Access Tokens → **Granular Access Token**, with read
and write on the `@leyline` scope, and an expiry you will notice before it bites
(npm mails a warning; put the renewal date somewhere you actually read).
Granular tokens publish without prompting for a one-time password, which is what
makes them usable from CI.

npm's trusted publishing — OIDC in place of a stored token — is where the
registry is heading, and is worth revisiting: the pnpm version this repository
pins publishes with a token, so a token is what the workflow uses.

**3. Store it.** Repository → Settings → Secrets and variables → Actions → New
repository secret, named `NPM_TOKEN`. The release workflow reads no other
secret; `GITHUB_TOKEN` is the one Actions provides.

## The routine

1. **Every change that alters a published package carries a changeset.**
   `pnpm changeset`, pick the packages, pick the bump, write the entry in the
   user's language — it becomes the changelog line someone reads at upgrade
   time.
2. **Merge to `main` as usual.** The release workflow opens or updates a pull
   request titled _Version packages_, holding the version bumps and the
   changelog entries the accumulated changesets produce.
3. **Read that pull request.** It is the release review: the version numbers are
   the claim you are making about compatibility, and the changelog is the only
   part of a release most people ever read. Wrong bump or a thin entry — fix the
   changeset on `main` and the pull request rewrites itself.
4. **Merge it.** The workflow runs `pnpm verify` against the merge commit, then
   `changeset publish`: each package goes to npm with a provenance attestation,
   git tags are pushed, and `changesets/action` opens a GitHub release per
   package from its changelog entry.

Nothing else is manual. There is no `npm publish` step anyone runs by hand, and
the version numbers in `package.json` are never edited directly.

## The first release is 1.0.0

Not an accident of the tooling, and not a soft launch. `@leyline/react`,
`@leyline/svelte`, `@leyline/vanilla`, and `@leyline/agent` take `@leyline/core`
as a **peer** dependency, and Changesets majors a peer-dependent whenever its
peer releases. Under `fixed` grouping that major reaches all seven packages, so
the first release lands on 1.0.0 whatever the changesets say — and, left alone,
so would every release after it.

`onlyUpdatePeerDependentsWhenOutOfRange: true` narrows that rule to the case it
exists for: an adapter takes a major only when the new core version actually
leaves the peer range it declares. Above 1.0.0 that works, because `^1.0.0`
covers `1.1.0`; below it, `^0.1.0` does not cover `0.2.0`, so a 0.x line would
have escalated every runtime minor into a major anyway. Starting at 1.0.0 is
what makes ordinary minor releases possible.

So 1.0.0 means what [`docs/versioning.md`](versioning.md) says it means: the
documented API is stable, breaking it needs a major, and the three internal
things named there stay outside the promise.

## What the workflow does and does not do

**CI does not run on the version pull request.** GitHub does not trigger
workflows for events raised with `GITHUB_TOKEN`, and the version pull request is
raised that way. Nothing is lost — the release job runs the full `pnpm verify`
against the merge commit before it publishes anything — but the pull request
carries no green check. Wanting one is the reason to swap in a personal access
token, and the reason not to is that the token would then sit in the repository
with push rights.

**A failed publish is safe to retry.** `changeset publish` asks the registry
what exists and skips versions already there, so re-running the job after a
network failure finishes the job rather than doubling it. What it cannot do is
take back a version: npm refuses to republish one, which is why `pnpm verify`
runs again immediately before the publish rather than trusting the earlier run.

**The third-party actions are pinned to commits.** `pnpm/action-setup` and
`changesets/action` are referenced by full commit SHA with the version in a
trailing comment, because this job holds a token that can publish to npm and
both of their short references move — `v4` is a tag the maintainers repoint, and
`changesets/action@v1` is a branch, not a tag at all. The cost is that a pin
goes stale quietly: updating means resolving the reference again
(`git ls-remote --tags https://github.com/changesets/action`) and changing the
SHA, not editing the comment beside it.

**Provenance needs the metadata to agree.** Each package's `repository` field
names this repository, and the workflow holds `id-token: write`. A fork
publishing under a different repository, or a package that loses that field,
publishes without attestation instead of failing loudly — worth a look on the
npm page after the first release.

## Using the packages before, or without, publishing

Inside this repository, nothing is needed: `pnpm-workspace.yaml` covers
`examples/*`, and the examples import `@leyline/core` exactly as an application
would.

From a project outside the repository, link the built packages:

```bash
pnpm build   # dist/ is what a consumer resolves
```

```jsonc
// package.json of the consuming project
{
  "dependencies": {
    "@leyline/core": "link:../leyline/packages/core",
    "@leyline/react": "link:../leyline/packages/react",
  },
}
```

`link:` symlinks the package directory and leaves its dependencies to the
monorepo's own `node_modules`, which is why it works before anything is on the
registry.

`pnpm pack` tarballs do not, on their own: the tarball's `package.json` asks for
`@leyline/schema` by name and version, and the registry has no such package yet.
Tarballs are for inspecting what a release will contain —

```bash
cd packages/core && pnpm pack --pack-destination /tmp/leyline-tarballs
tar tzf /tmp/leyline-tarballs/leyline-core-*.tgz
```

— which is worth doing once before the first release, because `files` and
`exports` mistakes are invisible until someone installs the result.

## Publishing somewhere else later

GitHub Packages is the usual reason to ask. It is a real option and it is not
free of cost:

- The scope must match the GitHub organisation, so all seven packages become
  `@khorum-oss/*`, and every import in every document and example changes with
  them.
- Consumers authenticate even for public packages: every machine and every CI
  job that installs them needs a GitHub token in `.npmrc`. That includes yours.
- Publishing to both means keeping two scopes in step, which is a permanent tax
  rather than a one-time setup.

If it is wanted anyway, the workflow changes little: point `registry-url` at
`https://npm.pkg.github.com`, and publish with the `GITHUB_TOKEN` the workflow
already holds instead of `NPM_TOKEN`. The renaming is the work, not the
plumbing.

A private registry of your own (Verdaccio, Artifactory, Cloudsmith) is the same
shape: one `registry-url`, one token, no renaming, and the burden of running it.

## After the first release

Update the **Status** section of [`README.md`](../README.md) — it says the
packages are not yet published, and it will be wrong the moment they are.

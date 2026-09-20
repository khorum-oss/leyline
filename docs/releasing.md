# Releasing

Seven packages publish to npm under the `@khorum-oss` scope, each named for the
part of Leyline it carries: `leyline-schema`, `leyline-core`, `leyline-dsl`,
`leyline-agent`, `leyline-react`, `leyline-svelte`, and `leyline-vanilla`. The
`@leyline` org was already taken; the scope is independent of the GitHub
organisation either way — the trusted publisher below names `khorum-oss/leyline`
because that is the repository, not the scope. They version together (`fixed`
in [`.changeset/config.json`](../.changeset/config.json)), so a release never
pairs a schema package with a runtime that reads a different contract. A package
version is not the [schema version](glossary.md#schema-version) a document
carries — [`versioning.md`](versioning.md) holds both sets of rules and the
difference between them. The example apps are `private` and never publish.

Releases run from [`.github/workflows/release.yml`](../.github/workflows/release.yml).
Nothing reaches npm from a laptop, and nothing reaches npm without a merged pull
request. The workflow holds no npm token: it authenticates as a
[trusted publisher](#one-time-setup), with an OIDC token GitHub mints for this
repository and this workflow file alone. The single exception to all of that is
the bootstrap below, which happened once, before any of it could be true.

## One-time setup

Done once, by someone with admin on both the npm org and the repository. The
order matters: npm attaches a trusted publisher to a package it already knows
about, so the records have to exist before OIDC can be switched on.

**1. Claim the scope.** Create the `leyline` organisation at
<https://www.npmjs.com/org/create>. The free plan publishes public packages,
which is what these are — every package already carries
`publishConfig.access: public`, so nothing in the repository changes. Creating
the org exists already, so nothing here waits on a name being free.

Enable two-factor authentication on the account while you are there. The trust
commands in step 3 refuse to run without it, and they refuse granular access
tokens carrying the bypass-2FA option too.

**2. Create the seven records.** This is the one publish that comes from a
laptop, and the one release that carries no provenance — attestations are minted
by the CI runner holding the OIDC token, and npm will not let a version be
republished to add one later. So what goes out here is 0.0.1 under a `bootstrap`
dist-tag: enough for the registry to know the names, and marked as what it is.

The tag does not keep it out of the way, though — npm points `latest` at the
first version a package ever publishes, whatever `--tag` asked for. So 0.0.1 is
what `npm install` resolves to until the first real release moves `latest`,
which is one more reason not to leave the rest of this setup half-done.

```bash
npm login
bash scripts/bootstrap-publish.sh          # or: ... 123456, with a 2FA code
```

Two-factor authentication has to be on the account before this works — npm
answers `403` for a write without it, and the trust commands in step 3 refuse to
run at all. How you answer the challenge decides what the script does: an
authenticator app produces a code, which can be passed as the argument, while a
passkey or security key produces nothing typable and is answered in a browser
instead.

That is why the script packs with pnpm and publishes with npm. Packing needs
pnpm — it is what rewrites `workspace:^` into `^0.0.1` inside the tarball — and
publishing needs npm, because pnpm accepts nothing but a typed `--otp` code and
has no browser flow to offer a passkey.

If a run stops partway, run it again: it skips whatever already reached the
registry, because npm will not let a version be published twice.

The script bumps `0.0.0` to `0.0.1`, publishes all seven, and puts the manifests
back — deliberately _without_ running `changeset version`, because the
accumulated changesets are what make the first real release 1.0.0, and consuming
them here would spend that.

**3. Configure trusted publishing.** `npm trust` is unaware of workspaces, so
all seven are a loop:

```bash
for pkg in schema core dsl agent react svelte vanilla; do
  npm trust github "@khorum-oss/leyline-$pkg" \
    --repo khorum-oss/leyline \
    --file release.yml \
    --allow-publish \
    --yes
done
```

`--file` is the workflow file name as it sits in `.github/workflows`, not a
path, and it is part of what npm checks: a release published from any other
workflow in this repository is refused. Confirm with
`npm trust list @khorum-oss/leyline-core`. The registry holds **one configuration per
package**, so changing it later means `npm trust revoke --id <id>` first — the
id comes from that same `list`.

Requirements, from `npm help trust`: npm 11.15.0 or later locally
(`npm install -g npm@^11.15.0`), 2FA on the account, and a real login rather
than a token.

**4. Shut the other door.** On npmjs.com, each package's Settings →
**Require two-factor authentication and disallow tokens**. A trusted publisher
does not, by itself, stop a token from publishing; this is what makes the
workflow the only way in. There is no `NPM_TOKEN` secret to delete, because the
workflow never had one.

After this the first CI release publishes 1.0.0 with provenance, and `latest`
moves off the bootstrap version for good.

## The routine

1. **Every change that alters a published package carries a changeset.**
   `pnpm changeset`, pick the packages, pick the bump, write the entry in the
   user's language — it becomes the changelog line someone reads at upgrade
   time.
2. **Merge to `main` as usual.** The release workflow versions the packages and
   pushes the result to `changeset-release/main`, holding the version bumps and
   the changelog entries the accumulated changesets produce.
3. **Open the pull request yourself, the first time round.**

   ```bash
   gh pr create --base main --head changeset-release/main --title 'Version packages'
   ```

   The workflow would do this, and fails trying: the organisation does not
   permit GitHub Actions to create pull requests, and the job reports
   `GitHub Actions is not permitted to create or approve pull requests` after
   the branch is already pushed. Nothing is lost when that happens — the
   versioning is on the branch, and the run can be ignored. Once a pull request
   is open, later runs update the branch under it without needing to create
   anything, so this is a once-per-release-cycle step rather than a daily one.

4. **Read that pull request.** It is the release review: the version numbers are
   the claim you are making about compatibility, and the changelog is the only
   part of a release most people ever read. Wrong bump or a thin entry — fix the
   changeset on `main` and the pull request rewrites itself.
5. **Merge it.** The workflow runs `pnpm verify` against the merge commit, then
   `changeset publish`: each package goes to npm with a provenance attestation,
   git tags are pushed, and `changesets/action` opens a GitHub release per
   package from its changelog entry.

Nothing else is manual. There is no `npm publish` step anyone runs by hand, and
the version numbers in `package.json` are never edited directly.

## The first release is 1.0.0

0.0.1 sits on the registry under the `bootstrap` tag and is not the first
release — it is the [setup step](#one-time-setup) that made trusted publishing
possible. 1.0.0 is the first version anyone installs.

Not an accident of the tooling, and not a soft launch. `@khorum-oss/leyline-react`,
`@khorum-oss/leyline-svelte`, `@khorum-oss/leyline-vanilla`, and `@khorum-oss/leyline-agent` take `@khorum-oss/leyline-core`
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
workflows for events raised with `GITHUB_TOKEN`. Nothing is lost — the release
job runs the full `pnpm verify` against the merge commit before it publishes
anything — but the pull request carries no green check. Wanting one, like
wanting the pull request opened automatically, is the reason to swap in a
personal access token; the reason not to is that the token would then sit in
the repository with push rights, which is the arrangement the rest of this
document exists to avoid.

**The organisation forbids Actions from opening pull requests**, which is why
step 3 is done by hand. It is an organisation-wide policy covering every
repository, and the switch that would lift it also lets workflows _approve_
pull requests — which is why it is off. One `gh pr create` per release cycle
buys that back.

**Trusted publishing has a toolchain floor.** pnpm runs the OIDC exchange
itself — 11.0.7 taught it to prefer a trusted publisher over a configured
`_authToken`, and 11.1.3 fixed the 404 it hit when `actions/setup-node` had
already written an `.npmrc` — so the `packageManager` field is load-bearing for
releases, not only for installs. The publish that follows the exchange still
goes through the npm CLI, which the workflow upgrades to 11 because Node 22
ships 10.

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
`examples/*`, and the examples import `@khorum-oss/leyline-core` exactly as an application
would.

From a project outside the repository, link the built packages:

```bash
pnpm build   # dist/ is what a consumer resolves
```

```jsonc
// package.json of the consuming project
{
  "dependencies": {
    "@khorum-oss/leyline-core": "link:../leyline/packages/core",
    "@khorum-oss/leyline-react": "link:../leyline/packages/react",
  },
}
```

`link:` symlinks the package directory and leaves its dependencies to the
monorepo's own `node_modules`, which is why it works before anything is on the
registry.

`pnpm pack` tarballs do not, on their own: the tarball's `package.json` asks for
`@khorum-oss/leyline-schema` by name and version, and the registry has no such package yet.
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

- The scope must match the GitHub organisation — which it already does, so
  nothing would need renaming. That cost applied to an `@leyline`-scoped
  project and no longer applies here; the two below still do.
- Consumers authenticate even for public packages: every machine and every CI
  job that installs them needs a GitHub token in `.npmrc`. That includes yours.
- Publishing to both means keeping two scopes in step, which is a permanent tax
  rather than a one-time setup.

If it is wanted anyway, the workflow changes little: point `registry-url` at
`https://npm.pkg.github.com` and publish with the `GITHUB_TOKEN` the workflow
already holds — which also means giving up trusted publishing, since the trust
configuration and the provenance attestation are npm's, not GitHub Packages'.

A private registry of your own (Verdaccio, Artifactory, Cloudsmith) is the same
shape: one `registry-url`, one token, no renaming, and the burden of running it.

## After the first release

Update the **Status** section of [`README.md`](../README.md) — it says the
packages are not yet published, and it will be wrong the moment they are.

Retire the bootstrap versions, so nobody reaches one by asking for the tag:

```bash
for pkg in schema core dsl agent react svelte vanilla; do
  npm dist-tag rm "@khorum-oss/leyline-$pkg" bootstrap
  npm deprecate "@khorum-oss/leyline-$pkg@0.0.1" "Registry placeholder from release setup; use 1.0.0 or later."
done
```

And check a package page for the provenance badge. A missing one means the
attestation did not attach — the workflow published, but something the
[metadata](#what-the-workflow-does-and-does-not-do) depends on disagreed.

#!/usr/bin/env bash
# One-time bootstrap — step 2 of docs/releasing.md's one-time setup, and the
# only publish in this project's history that does not come from CI.
#
# npm configures a trusted publisher against a package the registry already
# knows, so the seven records have to exist before OIDC can be turned on. This
# publishes 0.0.1 of each under the `bootstrap` dist-tag — not `latest`, so
# nothing installs it by accident — and puts the manifests back at 0.0.0
# afterwards: the accumulated changesets are what make the first real release
# 1.0.0, and `changeset version` must still find them, and still find 0.0.0.
#
# It is kept after it has served its purpose because it is the record of how
# the packages came to exist, and because a new scope would need it again.
#
# Run from the repository root, after `npm login`:
#
#     bash scripts/bootstrap-publish.sh [otp-code]
set -euo pipefail

PKGS=(schema core dsl agent react svelte vanilla)
OTP="${1:-}"

[[ -f pnpm-workspace.yaml ]] || { echo "Run this from the repository root." >&2; exit 1; }

echo "==> npm account"
npm whoami || { echo "Not logged in. Run 'npm login' first." >&2; exit 1; }

echo "==> manifests are clean and at 0.0.0"
if [[ -n "$(git status --porcelain packages)" ]]; then
  echo "packages/ has uncommitted changes; commit or stash before bootstrapping." >&2
  exit 1
fi
for p in "${PKGS[@]}"; do
  v=$(node -p "require('./packages/$p/package.json').version")
  [[ "$v" == "0.0.0" ]] || { echo "@khorum-oss/leyline-$p is at $v, expected 0.0.0 — has 'changeset version' already run?" >&2; exit 1; }
done

# Whatever happens below, the manifests go back to 0.0.0.
restore() { git checkout -- packages/*/package.json; echo "==> manifests restored to 0.0.0"; }
trap restore EXIT

echo "==> building"
pnpm build

echo "==> 0.0.0 -> 0.0.1 (temporary)"
for p in "${PKGS[@]}"; do
  perl -0pi -e 's/("version":\s*)"0\.0\.0"/$1"0.0.1"/' "packages/$p/package.json"
done

echo "==> publishing under the 'bootstrap' tag"
# --no-git-checks: the manifests are deliberately dirty right now, and this is
# not the branch a real release comes from.
pnpm -r --filter "./packages/**" publish \
  --tag bootstrap \
  --access public \
  --no-git-checks \
  ${OTP:+--otp "$OTP"}

echo "==> done. On the registry now:"
for p in "${PKGS[@]}"; do
  printf '  %-32s %s\n' "@khorum-oss/leyline-$p" "$(npm view "@khorum-oss/leyline-$p" dist-tags --json 2>/dev/null | tr -d '\n ' || echo '(not found)')"
done

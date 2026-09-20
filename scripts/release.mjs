#!/usr/bin/env node
/**
 * `changeset publish`, minus the false failure.
 *
 * A push to `main` with no changesets left puts Changesets into publish mode,
 * where it asks the registry which versions exist and skips those that do.
 * That check reads npm's aggregated package document, which is eventually
 * consistent: for minutes after a version is published it can still answer as
 * though it were not. Changesets then tries to publish a version that is
 * already there, and npm refuses with `E409 Cannot publish over previously
 * staged version` — a red release run reporting a release that in fact
 * succeeded, as happened to `@khorum-oss/leyline-react@1.0.0`.
 *
 * It is not a rare race. Every merge to `main` shortly after a release
 * re-enters publish mode, so any docs fix landing behind a release can trip it.
 *
 * So: run the publish, and if it fails, ask the registry about each package it
 * failed on — the per-version document, which is the one that is already
 * serving when the aggregated one is not. A failure whose version is on the
 * registry is a publish that happened. Anything else is a real failure and
 * still fails the job.
 */
import { spawn } from 'node:child_process';

const REGISTRY = process.env.npm_config_registry ?? 'https://registry.npmjs.org';

/** Run a command, streaming its output through while keeping a copy. */
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'] });
    let output = '';
    for (const [stream, sink] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ]) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        output += chunk;
        sink.write(chunk);
      });
    }
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

/**
 * The names and versions Changesets says it could not publish. It prints them
 * under a header, one per line, behind its butterfly prefix:
 *
 *   🦋  error packages failed to publish:
 *   🦋  @khorum-oss/leyline-react@1.0.0
 */
function failedPackages(output) {
  const lines = output.split('\n').map((line) =>
    line
      // eslint-disable-next-line no-control-regex -- colour codes, not content
      .replace(/\u001b\[[0-9;]*m/g, '')
      .replace(/^🦋\s*(error\s*)?/u, '')
      .trim(),
  );
  const header = lines.indexOf('packages failed to publish:');
  if (header === -1) return [];

  const failures = [];
  for (const line of lines.slice(header + 1)) {
    // The classes exclude `/` so a scoped name splits exactly one way. Letting
    // both halves match it would give the engine a choice per slash, and a
    // non-matching line would cost it every combination before giving up.
    const match = /^(?<name>@?[^@\s/]+(?:\/[^@\s/]+)?)@(?<version>\d\S*)$/u.exec(line);
    if (!match) break; // the list ends at the first line that is not one
    failures.push({ name: match.groups.name, version: match.groups.version });
  }
  return failures;
}

/** Is this exact version on the registry? Asks the per-version document. */
async function isPublished({ name, version }) {
  const url = `${REGISTRY.replace(/\/$/, '')}/${name.replace('/', '%2f')}/${version}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  return response.ok;
}

const { code, output } = await run('changeset', ['publish']);
if (code === 0) process.exit(0);

const failures = failedPackages(output);
if (failures.length === 0) {
  console.error('\nRelease failed, and not on a package publish. Leaving the failure alone.');
  process.exit(code ?? 1);
}

const checked = await Promise.all(
  failures.map(async (failure) => ({ ...failure, published: await isPublished(failure) })),
);

const missing = checked.filter((failure) => !failure.published);
for (const { name, version, published } of checked) {
  console.error(
    published
      ? `  ${name}@${version} is on the registry — the publish did happen`
      : `  ${name}@${version} is NOT on the registry`,
  );
}

if (missing.length > 0) {
  console.error('\nRelease failed: the versions above did not reach the registry.');
  process.exit(code ?? 1);
}

console.error(
  '\nEvery failure was a version already on the registry, which is what this ' +
    'release was asking for. Treating the release as successful.',
);

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `SECURITY.md` and the shipped invariant suites, checked against each other.
 *
 * The threat model is only worth reading if it describes what actually runs.
 * Two drifts make it stop doing that, and neither announces itself: a suite
 * written without the document hearing about it, and a document naming a suite
 * that no longer tests what it claims. Both directions are checked here.
 *
 * A third failure is quieter still and matters more. The CI job that runs these
 * suites names the vitest projects to run. Add an invariant test to a package
 * the filter does not list and it never runs again — a required gate that
 * passes because it checked nothing. So the filter is checked too.
 *
 * The vocabulary — invariant, inert, opaque, capability bundle — is defined in
 * [`glossary.md`](../docs/glossary.md#the-security-boundary).
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const securityDoc = readFileSync(join(root, 'SECURITY.md'), 'utf8');
const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');

const INVARIANTS = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'] as const;
type Invariant = (typeof INVARIANTS)[number];

/** Every test file under `packages/`, as a repository-relative POSIX path. */
function testFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.tsbuild', '.svelte-kit', 'coverage'].includes(entry.name)) {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...testFiles(path));
    else if (/\.test\.tsx?$/.test(entry.name))
      found.push(relative(root, path).split(sep).join('/'));
  }
  return found;
}

/**
 * Which invariants a file claims to test, read from its `describe` and `it`
 * titles rather than from anywhere a comment could lie.
 */
function claimedBy(file: string): Set<Invariant> {
  const source = readFileSync(join(root, file), 'utf8');
  const titles = [
    ...source.matchAll(
      /^\s*(?:describe|it)(?:\.each\([^)]*\))?\(\s*(['`])((?:\\.|(?!\1)[\s\S])*?)\1/gm,
    ),
  ].map((match) => match[2] as string);

  const found = new Set<Invariant>();
  for (const title of titles) {
    for (const match of title.matchAll(/\bI([1-7])\b/g)) {
      found.add(`I${match[1] as string}` as Invariant);
    }
  }
  return found;
}

const shipped = new Map<Invariant, string[]>(INVARIANTS.map((id) => [id, []]));
for (const file of testFiles(join(root, 'packages')).sort()) {
  for (const invariant of claimedBy(file)) shipped.get(invariant)?.push(file);
}

/** The `_Suites:_` line under each `### I<n>` heading in SECURITY.md. */
function documented(invariant: Invariant): string[] {
  const heading = new RegExp(`^### ${invariant} — .+$`, 'm').exec(securityDoc);
  if (heading?.index === undefined) return [];
  const after = heading.index + heading[0].length;
  const nextHeading = securityDoc.slice(after).search(/^#{2,3} /m);
  const section = securityDoc.slice(after, nextHeading === -1 ? undefined : after + nextHeading);
  const suites = /_Suites:_((?:[^\n]|\n(?!\n))+)/.exec(section);
  return [...(suites?.[1] ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1] as string).sort();
}

describe('every invariant in the threat model has a suite that tries to break it', () => {
  it.each(INVARIANTS)('%s names at least one suite', (invariant) => {
    expect(documented(invariant).length).toBeGreaterThan(0);
  });

  it.each(INVARIANTS)('%s has at least one suite that actually runs', (invariant) => {
    expect(shipped.get(invariant)?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('the threat model and the suites name each other', () => {
  it.each(INVARIANTS)('%s: SECURITY.md lists exactly what ships', (invariant) => {
    // Both directions in one assertion, because the interesting failure is the
    // diff: what was written without being recorded, and what was recorded
    // without being written.
    expect(documented(invariant)).toEqual(shipped.get(invariant));
  });
});

describe('the required gate still covers what it claims to', () => {
  const gate = /((?:--project \S+ )+)-t '(I1\|[^']*)'/.exec(workflow);

  it('finds the invariant job in the workflow', () => {
    expect(gate).not.toBeNull();
  });

  const projects = new Set(
    [...(gate?.[1] ?? '').matchAll(/--project (\S+)/g)].map((match) => match[1] as string),
  );

  const packagesWithSuites = [
    ...new Set([...shipped.values()].flat().map((file) => file.split('/')[1] as string)),
  ].sort();

  it.each(packagesWithSuites)('the %s package is in the project filter', (name) => {
    expect([...projects]).toContain(name);
  });

  it.each(INVARIANTS)('%s is in the title filter', (invariant) => {
    expect(gate?.[2] ?? '').toContain(invariant);
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_KINDS,
  INITIATOR_KINDS,
  NODE_KINDS,
  SEVERITIES,
  SURFACE_TYPES,
} from '@leyline/schema';

/**
 * The glossary is the one definition of the project's vocabulary, and every
 * other document links to it rather than re-explaining. Two things can rot
 * quietly: a link to an anchor that no longer exists, and a term the code grew
 * without the glossary hearing about it. These tests catch both.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const glossaryPath = join(root, 'docs', 'glossary.md');
const glossary = readFileSync(glossaryPath, 'utf8');

/** Every markdown file in the repository, excluding dependencies and changelogs. */
function markdownFiles(dir: string = root): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.tsbuild', 'coverage'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...markdownFiles(path));
    else if (entry.name.endsWith('.md')) found.push(path);
  }
  return found;
}

/** GitHub's heading-to-anchor rule, for the headings this glossary actually uses. */
function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\w\- ]/g, '')
    .trim()
    .replace(/ /g, '-');
}

const headings = [...glossary.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => match[2] as string);
const anchors = new Set(headings.map(slug));

describe('the glossary defines the vocabulary once', () => {
  it('gives every heading a distinct anchor, so no link is ambiguous', () => {
    const slugs = headings.map(slug);
    expect(slugs).toEqual([...new Set(slugs)]);
  });

  it.each(SURFACE_TYPES)('names the surface type %s', (type) => {
    // Surface types are the highest-cost vocabulary in the project. One arriving
    // in code without arriving here is the drift worth catching first.
    expect(glossary).toContain(type);
  });

  it.each(NODE_KINDS)('defines the node kind %s as its own entry', (kind) => {
    expect(anchors).toContain(kind);
  });

  it.each(INITIATOR_KINDS)('names the initiator kind %s', (kind) => {
    expect(glossary).toContain(kind);
  });

  it.each(SEVERITIES)('names the severity %s', (severity) => {
    expect(glossary).toContain(severity);
  });

  it.each(CAPABILITY_KINDS)('defines the capability kind %s as its own entry', (kind) => {
    const expected = kind === 'dataSource' ? 'data-source' : kind;
    expect(anchors).toContain(expected);
  });
});

describe('every link into the glossary resolves', () => {
  const links = markdownFiles().flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/glossary\.md#([\w-]+)/g)].map((match) => ({
      file: relative(root, file),
      anchor: match[1] as string,
    })),
  );

  it('finds links to check', () => {
    expect(links.length).toBeGreaterThan(5);
  });

  it.each(links)('$file → #$anchor', ({ anchor }) => {
    expect(anchors).toContain(anchor);
  });
});

describe('the glossary is reachable from everywhere it should be', () => {
  const shouldReference = markdownFiles().filter((file) => {
    const path = relative(root, file);
    if (path === 'docs/glossary.md' || path.includes('CHANGELOG')) return false;
    if (path.startsWith('.changeset/')) return false;
    // Individual decision records inherit the pointer from their index.
    if (/^docs\/decisions\/0\d+/.test(path) || path === 'docs/decisions/template.md') return false;
    return path.startsWith('docs/') || path.startsWith('packages/') || !path.includes('/');
  });

  it.each(shouldReference.map((f) => relative(root, f)))('%s links to the glossary', (path) => {
    expect(readFileSync(join(root, path), 'utf8')).toContain('glossary.md');
  });
});

describe('the validation rule catalogue stays complete', () => {
  const sources = ['validate.ts', 'normalize.ts', 'containment.ts'].map((name) =>
    readFileSync(join(root, 'packages', 'schema', 'src', name), 'utf8'),
  );
  const rules = [
    ...new Set(
      sources.flatMap((source) =>
        [...source.matchAll(/rule: '([a-z.-]+)'/g)].map((m) => m[1] as string),
      ),
    ),
  ].sort();
  const schemaReadme = readFileSync(join(root, 'packages', 'schema', 'README.md'), 'utf8');

  it('finds the rules to check', () => {
    expect(rules.length).toBeGreaterThan(10);
  });

  it.each(rules)('%s appears in the @leyline/schema README catalogue', (rule) => {
    expect(schemaReadme).toContain(rule);
  });
});

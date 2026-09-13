import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The decision trail has to stay navigable from its index, not just from `ls`.
 *
 * Two drifts are quiet and both happened: a record written without its row in
 * the index, and an open question answered by a record without being struck
 * through. Either one leaves a reader with a document that is wrong rather than
 * merely incomplete — the index said there were three decisions when there were
 * eighteen, and the open-questions page said "all eight decided" above a table
 * that still read as though six were open.
 *
 * Vocabulary is in [`glossary.md`](../docs/glossary.md).
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const decisionsDir = join(root, 'docs', 'decisions');
const index = readFileSync(join(decisionsDir, 'README.md'), 'utf8');
const openQuestions = readFileSync(join(root, 'docs', 'open-questions.md'), 'utf8');

interface Record_ {
  readonly file: string;
  readonly id: string;
  readonly title: string;
  readonly closes: readonly string[];
}

const records: Record_[] = readdirSync(decisionsDir)
  .filter((name) => /^\d{4}-.+\.md$/.test(name))
  .sort()
  .map((file) => {
    const source = readFileSync(join(decisionsDir, file), 'utf8');
    const heading = /^# (\d{4})\. (.+)$/m.exec(source);
    const closes = /^- \*\*Closes:\*\* (.+)$/m.exec(source);
    return {
      file,
      id: heading?.[1] ?? '',
      title: heading?.[2] ?? '',
      closes: [...(closes?.[1] ?? '').matchAll(/OQ\d+/g)].map((match) => match[0]),
    };
  });

describe('every decision is reachable from the index', () => {
  it('finds records to check', () => {
    expect(records.length).toBeGreaterThan(10);
  });

  it.each(records)('$file is listed', ({ file }) => {
    expect(index).toContain(`(${file})`);
  });

  it.each(records)('$file is listed under its own title', ({ title }) => {
    expect(index).toContain(title);
  });

  it.each(records)('$file numbers its heading to match its filename', ({ file, id }) => {
    expect(file.startsWith(`${id}-`)).toBe(true);
  });

  it('lists nothing that does not exist', () => {
    const linked = [...index.matchAll(/\((\d{4}-[a-z0-9-]+\.md)\)/g)].map((match) => match[1]);
    const present = new Set(records.map((record) => record.file));
    expect(linked.filter((file) => !present.has(file as string))).toEqual([]);
  });
});

describe('an answered question says so where it was asked', () => {
  const answered = records.flatMap((record) =>
    record.closes.map((question) => ({ question, file: record.file })),
  );

  it('finds closures to check', () => {
    expect(answered.length).toBeGreaterThan(5);
  });

  it.each(answered)('$question is struck through in open-questions.md', ({ question }) => {
    expect(openQuestions).toContain(`~~${question}~~`);
  });

  it.each(answered)('$question points at $file', ({ file }) => {
    expect(openQuestions).toContain(`decisions/${file}`);
  });

  it('claims no more closures than it can show', () => {
    // "All eight are closed" is a claim about the table below it. If a question
    // is ever reopened, the sentence has to move too.
    const asked = new Set([...openQuestions.matchAll(/OQ(\d+)/g)].map((match) => match[0]));
    const closed = new Set(answered.map((entry) => entry.question));
    expect([...asked].filter((question) => !closed.has(question))).toEqual([]);
  });
});

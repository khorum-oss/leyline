import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The reference corpus, read as text rather than imported as a module.
 *
 * Reading the bytes is the point: round-trip tests compare what comes out of a
 * parse against the file itself, and the planned Kotlin DSL compares its own
 * output against these same bytes (brief §10).
 */
const here = dirname(fileURLToPath(import.meta.url));

export const FIXTURE_NAMES = ['workspace-onboarding'] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

export function fixtureText(name: FixtureName): string {
  return readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8');
}

export function fixtureJson(name: FixtureName): unknown {
  return JSON.parse(fixtureText(name));
}

#!/usr/bin/env node
/**
 * Regenerates the published JSON Schema artifacts (AD9).
 *
 * Run `pnpm --filter @leyline/schema run schema:export` after changing a Zod
 * definition. The test suite compares the committed artifacts against the same
 * export function, so skipping this step fails the build rather than shipping a
 * contract that disagrees with the code.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportJsonSchemas } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'schema');
mkdirSync(out, { recursive: true });

for (const [name, document] of Object.entries(exportJsonSchemas())) {
  const path = join(out, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`wrote ${name}.json`);
}

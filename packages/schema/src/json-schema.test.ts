import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { exportJsonSchemas, workflowJsonSchema } from './json-schema.js';
import { fixtureJson } from './fixtures.js';
import { validateWorkflow } from './validate.js';

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');

function committed(name: string): unknown {
  return JSON.parse(readFileSync(join(schemaDir, `${name}.json`), 'utf8'));
}

/** Draft 2020-12, with Ajv's own authoring lint off — this schema is generated. */
function ajv(): Ajv2020 {
  return new Ajv2020({ strict: false, allErrors: true });
}

describe('the published JSON Schema artifacts (AD9)', () => {
  it('match what this build exports, so the contract cannot drift from the code', () => {
    for (const [name, document] of Object.entries(exportJsonSchemas())) {
      expect(
        committed(name),
        `${name}.json is stale — run pnpm --filter @leyline/schema run schema:export`,
      ).toEqual(document);
    }
  });

  it('carry the identifier rule as a pattern, so a non-TypeScript producer is held to it (I5)', () => {
    const workflow = workflowJsonSchema() as Record<string, any>;
    expect(workflow['$defs']['LeylineIdentifier'].pattern).toBe('^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$');
  });

  it('carry the supported version rule as a pattern', () => {
    const workflow = workflowJsonSchema() as Record<string, any>;
    expect(
      workflow['$defs']['LeylineWorkflowDocument'].properties.leylineVersion.pattern,
    ).toContain('^(1)');
  });
});

describe('the exported schema and the TypeScript validator agree', () => {
  const validate = ajv().compile(workflowJsonSchema());

  it('both accept the reference workflow', () => {
    const document = fixtureJson('workspace-onboarding');
    expect(validate(document), JSON.stringify(validate.errors)).toBe(true);
    expect(validateWorkflow(document).ok).toBe(true);
  });

  it('both reject an identifier carrying path structure', () => {
    const document = fixtureJson('workspace-onboarding') as Record<string, any>;
    document['nodes'][0].id = '../../etc/passwd';
    expect(validate(document)).toBe(false);
    expect(validateWorkflow(document).ok).toBe(false);
  });

  it('both reject a document from a different major version', () => {
    const document = fixtureJson('workspace-onboarding') as Record<string, any>;
    document['leylineVersion'] = '2.0.0';
    expect(validate(document)).toBe(false);
    expect(validateWorkflow(document).ok).toBe(false);
  });

  it('both accept a document carrying a field this build does not know (AD8)', () => {
    const document = fixtureJson('workspace-onboarding') as Record<string, any>;
    document['nodes'][0].futureField = { added: 'in a later minor version' };
    expect(validate(document), JSON.stringify(validate.errors)).toBe(true);
    expect(validateWorkflow(document).ok).toBe(true);
  });
});

describe('every published artifact compiles as a schema', () => {
  it.each(Object.keys(exportJsonSchemas()))('%s', (name) => {
    expect(() => ajv().compile(committed(name) as object)).not.toThrow();
  });
});

import { z } from 'zod';
import { SCHEMA_VERSION } from './version.js';
import { workflowDocumentSchema } from './workflow.js';
import {
  changeSchema,
  changeRecordSchema,
  proposalSchema,
  policyDecisionSchema,
} from './changes.js';
import { traceEventSchema } from './trace.js';
import { issueSchema } from './issues.js';

/**
 * JSON Schema export (AD9).
 *
 * Zod holds the single definition; JSON Schema is derived from it, never
 * written by hand. That is what lets a non-TypeScript producer — an agent
 * generating documents directly, or the planned Kotlin DSL — validate against
 * an identical contract rather than a description of one.
 *
 * The output is a published, versioned artifact, committed under `schema/` and
 * checked against this function in the test suite. A change to a Zod definition
 * that skips regenerating the artifact fails the build rather than shipping a
 * contract that quietly disagrees with the code.
 */

export type JsonSchemaDocument = Record<string, unknown>;

const BASE_URI = 'https://leyline.dev/schema';

function exportOne(schema: z.ZodType, name: string, title: string): JsonSchemaDocument {
  const exported = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as JsonSchemaDocument;
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${BASE_URI}/${SCHEMA_VERSION}/${name}.json`,
    title,
    'x-leyline-version': SCHEMA_VERSION,
    ...exported,
  };
}

/** Every artifact this build publishes, keyed by file name. */
export function exportJsonSchemas(): Record<string, JsonSchemaDocument> {
  return {
    'leyline-workflow': exportOne(
      workflowDocumentSchema,
      'leyline-workflow',
      'Leyline workflow document',
    ),
    'leyline-change': exportOne(changeSchema, 'leyline-change', 'Leyline change description'),
    'leyline-proposal': exportOne(proposalSchema, 'leyline-proposal', 'Leyline proposal'),
    'leyline-change-record': exportOne(
      changeRecordSchema,
      'leyline-change-record',
      'Leyline change record',
    ),
    'leyline-policy-decision': exportOne(
      policyDecisionSchema,
      'leyline-policy-decision',
      'Leyline policy decision',
    ),
    'leyline-trace-event': exportOne(
      traceEventSchema,
      'leyline-trace-event',
      'Leyline trace event',
    ),
    'leyline-issue': exportOne(issueSchema, 'leyline-issue', 'Leyline issue'),
  };
}

/** The workflow document contract on its own, for callers wanting just the one. */
export function workflowJsonSchema(): JsonSchemaDocument {
  return exportOne(workflowDocumentSchema, 'leyline-workflow', 'Leyline workflow document');
}

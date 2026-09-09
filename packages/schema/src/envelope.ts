import { z } from 'zod';
import { identifierSchema } from './primitives.js';
import { SUPPORTED_VERSION_PATTERN_SOURCE } from './version.js';

/**
 * The envelope every Leyline document carries.
 *
 * Stage 1 of the delivery sequence grows the full workflow, node, surface, and
 * change-description definitions around this seed. The envelope stays loose so
 * that a document written against a later minor version still parses, which is
 * what makes evolution additive (AD8).
 */
export const documentEnvelopeSchema = z.looseObject({
  leylineVersion: z
    .string()
    .regex(new RegExp(SUPPORTED_VERSION_PATTERN_SOURCE), 'unsupported schema major version'),
  id: identifierSchema,
  name: z.string().min(1),
});

export type DocumentEnvelope = z.infer<typeof documentEnvelopeSchema>;

import { z } from 'zod';
import { isSupportedSchemaVersion } from './version.js';
import { isValidId } from './ids.js';

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
    .refine(isSupportedSchemaVersion, { message: 'unsupported schema major version' }),
  id: z.string().refine(isValidId, { message: 'identifier carries path or URL structure (I5)' }),
  name: z.string().min(1),
});

export type DocumentEnvelope = z.infer<typeof documentEnvelopeSchema>;

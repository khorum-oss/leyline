import { z } from 'zod';
import { capabilityNameSchema, identifierSchema } from './primitives.js';
import { contextShapeSchema } from './context.js';
import { nodeSchema } from './node.js';
import { SUPPORTED_VERSION_PATTERN_SOURCE } from './version.js';

/**
 * The schema's self-declared capability list, used for fail-fast verification
 * at binding time (G8).
 *
 * Declaring requirements separately from their use sites is what lets binding
 * report every gap at once, before a user ever clicks anything, and what lets
 * an agent read the closed set of names it may reference (I2).
 */
export const requirementsSchema = z
  .looseObject({
    guards: z.array(capabilityNameSchema).optional(),
    services: z.array(capabilityNameSchema).optional(),
    dataSources: z.array(capabilityNameSchema).optional(),
  })
  .meta({
    id: 'LeylineRequirements',
    title: 'Requirements block',
    description: 'Every capability name this document may reference. Binding verifies the set.',
  });

export type Requirements = z.infer<typeof requirementsSchema>;

/**
 * A complete named graph: a context shape, an entry node, and a set of nodes.
 *
 * The document is the canonical artifact (AD1). Everything else in the system
 * either produces or consumes exactly this.
 */
export const workflowDocumentSchema = z
  .looseObject({
    leylineVersion: z
      .string()
      .regex(new RegExp(SUPPORTED_VERSION_PATTERN_SOURCE), 'unsupported schema major version'),
    id: identifierSchema,
    name: z.string().min(1),
    description: z.string().optional(),
    entry: identifierSchema,
    context: contextShapeSchema.optional(),
    requires: requirementsSchema.optional(),
    nodes: z.array(nodeSchema).min(1),
  })
  .meta({
    id: 'LeylineWorkflowDocument',
    title: 'Leyline workflow document',
    description:
      'The canonical, serializable description of a workflow: sequencing, eligibility, navigation, and semantic UI intent.',
  });

export type WorkflowDocument = z.infer<typeof workflowDocumentSchema>;

export const WORKFLOW_KEYS = Object.keys(workflowDocumentSchema.shape);
export const REQUIREMENTS_KEYS = Object.keys(requirementsSchema.shape);

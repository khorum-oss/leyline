import { z } from 'zod';
import { identifierSchema } from './primitives.js';
import { surfaceSchema } from './surface.js';
import { eventTransitionSchema, invokeSchema } from './transition.js';

/**
 * A position in the workflow.
 *
 * `kind` is a plain string for the same reason `type` is on a surface: an
 * unknown kind degrades through a fallback rather than failing to parse (AD8).
 * v1 defines `step` — performs work, transitions onward — and `hub`, a stable
 * destination offering navigable options.
 */
export const nodeSchema = z
  .looseObject({
    id: identifierSchema,
    kind: z.string().min(1),
    description: z.string().optional(),
    surfaces: z.array(surfaceSchema).optional(),
    invoke: invokeSchema.optional(),
    on: z.array(eventTransitionSchema).optional(),
  })
  .meta({
    id: 'LeylineNode',
    title: 'Node',
    description: 'A position in the workflow graph, with the surfaces it presents.',
  });

export type WorkflowNode = z.infer<typeof nodeSchema>;

export const NODE_KEYS = Object.keys(nodeSchema.shape);

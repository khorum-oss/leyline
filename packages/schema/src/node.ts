import { z } from 'zod';
import { identifierSchema } from './primitives.js';
import { SECTION_MODES } from './vocabulary.js';
import { surfaceSchema } from './surface.js';
import { eventTransitionSchema, invokeSchema } from './transition.js';

/**
 * A position in the workflow.
 *
 * `kind` is a plain string for the same reason `type` is on a surface: an
 * unknown kind degrades through a fallback rather than failing to parse (AD8).
 * v1 defines `step` — performs work, transitions onward — `hub`, a stable
 * destination offering navigable options, and `section`, which contains other
 * nodes.
 *
 * A section names its children rather than nesting them (decision 0019). The
 * `nodes` array stays flat, so a transition target remains a plain identifier
 * with no path syntax (I5), a diff stays small, and an agent walking the
 * document meets one list rather than a tree.
 */
export const nodeSchema = z
  .looseObject({
    id: identifierSchema,
    kind: z.string().min(1),
    description: z.string().optional(),
    surfaces: z.array(surfaceSchema).optional(),
    /**
     * For `section` nodes: the children it contains, by identifier, in the
     * order a renderer should present them unless a viewer has said otherwise.
     * Order is reading order — a semantic sequence, never a layout instruction.
     */
    children: z.array(identifierSchema).optional(),
    /** For `section` nodes: whether one child runs at a time, or all of them. */
    mode: z.enum(SECTION_MODES).optional(),
    /** For `section` nodes in `one` mode: which child the section starts at. */
    initial: identifierSchema.optional(),
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

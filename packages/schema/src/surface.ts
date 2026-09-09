import { z } from 'zod';
import { capabilityNameSchema, identifierSchema, propsSchema } from './primitives.js';

/**
 * A declaration of semantic UI intent (G6).
 *
 * `type` is a plain string rather than an enum on purpose. A consumer meeting an
 * unknown surface type must degrade through a fallback rather than reject the
 * document (AD8), which it cannot do if parsing already failed. Validation
 * reports an unknown type as a warning, so authors still hear about a typo.
 *
 * Layout never appears here. A schema able to express "row of two columns" has
 * become a worse HTML and has failed (brief §4).
 */
export const surfaceSchema = z
  .looseObject({
    /** Optional: a deterministic identifier is derived where none is supplied (AD12). */
    id: identifierSchema.optional(),
    type: z.string().min(1),
    /** Carried into agent introspection, so `describe()` reads like documentation. */
    description: z.string().optional(),
    /** Guard gating the surface's presence. Conditional presence is normal (G7). */
    when: capabilityNameSchema.optional(),
    /** Name of the data source providing this surface's data. */
    dataSource: capabilityNameSchema.optional(),
    /** For `link` surfaces: the node this link navigates to. */
    target: identifierSchema.optional(),
    /** Inert configuration handed to whichever renderer claims the surface. */
    props: propsSchema.optional(),
  })
  .meta({
    id: 'LeylineSurface',
    title: 'Surface',
    description: 'Semantic UI intent attached to a node, resolved to a component by a registry.',
  });

export type Surface = z.infer<typeof surfaceSchema>;

/** Known keys, used to warn on a probable typo without rejecting the document. */
export const SURFACE_KEYS = Object.keys(surfaceSchema.shape);

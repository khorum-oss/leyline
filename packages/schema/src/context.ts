import { z } from 'zod';
import { identifierSchema } from './primitives.js';

/**
 * The declared shape of a workflow's context.
 *
 * Context is the input to guard evaluation, and it is also the one place an
 * initiator can write data through a change description. Declaring the shape is
 * what makes I4 checkable: a value written into context gets validated against
 * this declaration and stays inert thereafter.
 *
 * The vocabulary stays deliberately coarse. Leyline validates that a value is
 * the declared kind, not that it satisfies an application's business rules —
 * those live in guards, where they can be tested on their own.
 */

export const CONTEXT_FIELD_TYPES = [
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'unknown',
] as const;

export type ContextFieldType = (typeof CONTEXT_FIELD_TYPES)[number];

export const contextFieldSchema = z
  .strictObject({
    type: z.enum(CONTEXT_FIELD_TYPES),
    optional: z.boolean().optional(),
    description: z.string().optional(),
  })
  .meta({ id: 'LeylineContextField', title: 'Context field' });

export const contextShapeSchema = z.record(identifierSchema, contextFieldSchema).meta({
  id: 'LeylineContextShape',
  title: 'Context shape',
  description: 'The typed data a workflow instance carries, keyed by field name.',
});

export type ContextShape = z.infer<typeof contextShapeSchema>;

/** Reports whether a value matches a declared field type. */
export function matchesFieldType(type: ContextFieldType, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'unknown':
      return true;
  }
}

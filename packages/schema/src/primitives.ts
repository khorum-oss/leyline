import { z } from 'zod';
import { ID_PATTERN_SOURCE } from './ids.js';

/**
 * The small vocabulary of scalars every other definition builds on.
 *
 * Identifiers and capability names share one rule, which is what keeps I5
 * enforceable in a single place: nothing addressable may carry path or URL
 * structure.
 */

export const identifierSchema = z
  .string()
  .regex(new RegExp(ID_PATTERN_SOURCE), 'identifier carries path or URL structure (I5)')
  .meta({
    id: 'LeylineIdentifier',
    title: 'Identifier',
    description:
      'An opaque, stable identifier. Author-supplied names or system-derived content hashes; never a path, URL, or expression.',
  });

/** Guards, services, and data sources are referenced by name only (AD2). */
export const capabilityNameSchema = identifierSchema.meta({
  id: 'LeylineCapabilityName',
  title: 'Capability name',
  description:
    'The name of a guard, service, or data source. Implementations bind separately through a capability bundle; a document can never carry one.',
});

const EVENT_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

export const eventNameSchema = z
  .string()
  .regex(EVENT_NAME, 'event names are plain tokens, not paths or expressions')
  .meta({ id: 'LeylineEventName', title: 'Event name' });

/**
 * Inert data. Nothing in the core, the adapters, or the agent package ever
 * interprets one of these values as an identifier, a path, a URL, or code (I4).
 */
export const jsonValueSchema = z.json().meta({
  id: 'LeylineJsonValue',
  title: 'JSON value',
  description: 'Arbitrary serializable data, treated as inert by every consumer (I4).',
});

export const propsSchema = z
  .record(identifierSchema, jsonValueSchema)
  .meta({ id: 'LeylineProps', title: 'Renderer props' });

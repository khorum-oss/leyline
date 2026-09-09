import { z } from 'zod';
import { identifierSchema } from './primitives.js';
import { initiatorSchema } from './changes.js';

/**
 * The trace envelope (AD15).
 *
 * Fixed and small: an envelope plus a payload that references things by
 * identifier rather than embedding them. A consumer wanting the whole object
 * asks the control plane for it, which is what keeps an event to a few hundred
 * bytes and keeps the stream cheap enough to leave on.
 *
 * The definition lives here rather than in the core so that a log line, an MCP
 * tool result, and a devtools panel all validate against one published
 * contract.
 */

export const TRACE_KINDS = [
  'workflow.bound',
  'workflow.transition',
  'workflow.snapshot',
  'guard.evaluated',
  'service.invoked',
  'service.settled',
  'surface.unresolved',
  'control.proposed',
  'control.policy',
  'control.validated',
  'control.applied',
  'control.reverted',
] as const;

export type TraceKind = (typeof TRACE_KINDS)[number];

export const traceEventSchema = z
  .strictObject({
    ts: z.number().int().nonnegative(),
    /** Monotonic within one instance, so ordering survives an out-of-order sink. */
    seq: z.number().int().nonnegative(),
    /** Open on purpose: an unknown kind is data a later build emits, not a fault. */
    kind: z.string().min(1),
    /** Ties a user event to the transition it caused and everything that followed. */
    correlationId: identifierSchema,
    initiator: initiatorSchema,
    /** Identifiers and small scalars. Never a snapshot, a component, or a document. */
    data: z.record(z.string(), z.json()),
  })
  .meta({
    id: 'LeylineTraceEvent',
    title: 'Trace event',
    description: 'One message on the core’s single ordered observability stream.',
  });

export type TraceEvent = z.infer<typeof traceEventSchema>;

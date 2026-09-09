import { z } from 'zod';
import {
  capabilityNameSchema,
  eventNameSchema,
  identifierSchema,
  propsSchema,
} from './primitives.js';

/**
 * Guarded movement between nodes.
 *
 * A transition names its target and, optionally, the guard that gates it. Both
 * are names; neither is a function (AD2).
 */
export const transitionSchema = z
  .looseObject({
    id: identifierSchema.optional(),
    target: identifierSchema,
    when: capabilityNameSchema.optional(),
    description: z.string().optional(),
  })
  .meta({ id: 'LeylineTransition', title: 'Transition' });

export type Transition = z.infer<typeof transitionSchema>;

/** A transition taken when an event arrives. */
export const eventTransitionSchema = transitionSchema
  .extend({ on: eventNameSchema })
  .meta({ id: 'LeylineEventTransition', title: 'Event transition' });

export type EventTransition = z.infer<typeof eventTransitionSchema>;

/**
 * An asynchronous operation a node performs, with its outcome routed onward.
 *
 * The service is a name. Its result may be assigned into a declared context
 * field, which is the only route from the outside world into context and is
 * therefore checked against the declared shape.
 */
export const invokeSchema = z
  .looseObject({
    service: capabilityNameSchema,
    /** Inert input handed to the service implementation. */
    input: propsSchema.optional(),
    /** Context field receiving the result. Must exist in the declared shape. */
    assignTo: identifierSchema.optional(),
    onDone: z.array(transitionSchema).optional(),
    onError: z.array(transitionSchema).optional(),
  })
  .meta({ id: 'LeylineInvoke', title: 'Service invocation' });

export type Invoke = z.infer<typeof invokeSchema>;

export const TRANSITION_KEYS = Object.keys(transitionSchema.shape);
export const EVENT_TRANSITION_KEYS = Object.keys(eventTransitionSchema.shape);
export const INVOKE_KEYS = Object.keys(invokeSchema.shape);

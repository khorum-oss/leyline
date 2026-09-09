import type { JsonValue } from '@leyline/schema';
import type { TraceEvent, TraceSink, RedactionHook } from '../trace.js';
import type { RuntimeMode } from '../contracts.js';

/** Sinks and the redaction hook the core ships (AD15). */

/** Writes each event as one line. Useful in a terminal, never in a hot loop. */
export function consoleSink(
  write: (message: string, event: TraceEvent) => void = (message) => console.log(message),
): TraceSink {
  return (event) => {
    write(`[leyline ${event.seq}] ${event.kind} (${event.correlationId})`, event);
  };
}

/** Collects events in order. The simplest useful sink, and what tests assert on. */
export function collectingSink(into: TraceEvent[]): TraceSink {
  return (event) => {
    into.push(event);
  };
}

export interface RedactionOptions {
  readonly mode: RuntimeMode;
  /**
   * Context keys whose values survive redaction in production. Everything else
   * under a payload's `context` becomes a placeholder.
   */
  readonly allow?: readonly string[];
  readonly placeholder?: string;
}

const REDACTED = '[redacted]';

/**
 * The default redaction hook.
 *
 * Development redacts nothing — a developer reading their own stream wants to
 * see the values. Production redacts every context value unless an allow-list
 * names it, because context is where an application's sensitive data lives and
 * a trace stream tends to end up somewhere it was not designed for.
 *
 * Only values under a payload's `context` key are touched. Identifiers, kinds,
 * and counts stay legible, so a redacted stream is still worth reading.
 */
export function createRedaction(options: RedactionOptions): RedactionHook {
  const placeholder = options.placeholder ?? REDACTED;
  const allow = new Set(options.allow ?? []);

  return (event) => {
    if (options.mode === 'development') return event;
    const context = event.data['context'];
    if (context === null || typeof context !== 'object' || Array.isArray(context)) return event;

    const redacted: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(context as Record<string, JsonValue>)) {
      redacted[key] = allow.has(key) ? value : placeholder;
    }
    return { ...event, data: { ...event.data, context: redacted } };
  };
}

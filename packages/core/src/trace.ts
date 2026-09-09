import type { TraceEvent, TraceKind } from '@leyline/schema';

/**
 * Observability as a single lightweight emission (AD15).
 *
 * One ordered stream carries everything observable: transitions, service
 * invocations, guard evaluations, snapshot publication, proposals, policy
 * decisions, applies, reverts, and binding-time verification. The change log is
 * a projection of this stream, so the audit trail can never disagree with it.
 *
 * The envelope and the kind vocabulary live in `@leyline/schema`, published as
 * JSON Schema, so a log line, an MCP tool result, and a devtools panel all
 * validate against one contract. This module adds only what the core needs to
 * emit and consume them.
 */

export { TRACE_KINDS, type TraceKind, type TraceEvent } from '@leyline/schema';

export type TraceSink = (event: TraceEvent) => void;

/** Applied before any sink receives an event. Sinks only ever see redacted payloads. */
export type RedactionHook = (event: TraceEvent) => TraceEvent;

export interface TraceStream {
  attach(sink: TraceSink): () => void;
  setRedaction(hook: RedactionHook): void;
  /** From the built-in bounded ring buffer. */
  recent(count?: number): readonly TraceEvent[];
  /** Which kinds emit at all, so frequent guard events can be silenced (OQ8). */
  setEnabledKinds(kinds: readonly (TraceKind | string)[] | 'all'): void;
}

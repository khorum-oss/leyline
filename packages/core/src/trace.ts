/**
 * Observability as a single lightweight emission (AD15).
 *
 * One ordered stream carries everything observable: transitions, service
 * invocations, guard evaluations, snapshot publication, proposals, policy
 * decisions, applies, reverts, and binding-time verification. The change log is
 * a projection of this stream, so the audit trail can never disagree with it.
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

/**
 * The fixed envelope. Payloads reference things by identifier rather than
 * embedding them; a consumer wanting the whole object asks the control plane.
 * Target a few hundred bytes per event as a working ceiling (brief §8).
 */
export interface TraceEvent {
  readonly ts: number;
  readonly seq: number;
  readonly kind: TraceKind | (string & {});
  readonly correlationId: string;
  readonly initiator: { readonly kind: string; readonly label?: string };
  readonly data: Readonly<Record<string, unknown>>;
}

export type TraceSink = (event: TraceEvent) => void;

/** Applied before any sink receives an event. Sinks only ever see redacted payloads. */
export type RedactionHook = (event: TraceEvent) => TraceEvent;

export interface TraceStream {
  attach(sink: TraceSink): () => void;
  setRedaction(hook: RedactionHook): void;
  /** From the built-in bounded ring buffer. */
  recent(count?: number): readonly TraceEvent[];
  /** Which kinds emit at all, so frequent guard events can be silenced (OQ9). */
  setEnabledKinds(kinds: readonly (TraceKind | string)[] | 'all'): void;
}

import type { TraceEvent, TraceSink, RedactionHook, TraceKind } from '../trace.js';
import type { JsonValue } from '@leyline/schema';
import type { Initiator, RuntimeMode } from '../contracts.js';

/**
 * The single ordered emitter (AD15).
 *
 * Everything observable in Leyline passes through here: transitions, guard
 * evaluations, service invocations, snapshot publications, proposals, policy
 * decisions, applies, and reverts.
 *
 * **Zero cost when unobserved.** With no sink attached and no ring buffer,
 * `emit` returns after one boolean check and allocates nothing. Callers on hot
 * paths — guard evaluation above all — check `isEnabled` before building a
 * payload, so the payload itself is never constructed for a stream nobody is
 * reading.
 */

export interface TraceEmitterOptions {
  readonly mode: RuntimeMode;
  /**
   * Ring-buffer capacity. Development keeps a small buffer so `recent()` and
   * devtools work without setup; production keeps none, so an unobserved
   * instance allocates nothing at all.
   */
  readonly bufferSize?: number;
  readonly redaction?: RedactionHook;
  readonly enabledKinds?: readonly (TraceKind | string)[] | 'all';
  /** Identifies the exported bundle. */
  readonly workflowId: string;
  readonly schemaVersion: string;
  /** Injectable for deterministic tests. */
  readonly now?: () => number;
}

export interface TraceExport {
  readonly workflowId: string;
  readonly schemaVersion: string;
  readonly capacity: number;
  /** Events the buffer discarded to stay within capacity. */
  readonly dropped: number;
  readonly events: readonly TraceEvent[];
}

export interface EmitInput {
  readonly kind: TraceKind | string;
  readonly correlationId: string;
  readonly initiator: Initiator;
  readonly data?: Readonly<Record<string, JsonValue>>;
}

const DEFAULT_DEVELOPMENT_BUFFER = 200;

export class TraceEmitter {
  readonly #sinks = new Set<TraceSink>();
  readonly #capacity: number;
  readonly #buffer: TraceEvent[] = [];
  readonly #workflowId: string;
  readonly #schemaVersion: string;
  readonly #now: () => number;
  #redaction: RedactionHook | undefined;
  #enabled: ReadonlySet<string> | 'all';
  #seq = 0;
  #dropped = 0;

  constructor(options: TraceEmitterOptions) {
    this.#capacity =
      options.bufferSize ?? (options.mode === 'development' ? DEFAULT_DEVELOPMENT_BUFFER : 0);
    this.#workflowId = options.workflowId;
    this.#schemaVersion = options.schemaVersion;
    this.#now = options.now ?? Date.now;
    this.#redaction = options.redaction;
    this.#enabled =
      options.enabledKinds === undefined || options.enabledKinds === 'all'
        ? 'all'
        : new Set(options.enabledKinds);
  }

  /**
   * Whether anything would receive an event of this kind.
   *
   * Check this before assembling a payload on a hot path. Guard evaluations are
   * the reason it exists: they are frequent, and building a payload for a
   * stream with no reader is the one cost the design refuses to pay.
   */
  isEnabled(kind: TraceKind | string): boolean {
    if (this.#sinks.size === 0 && this.#capacity === 0) return false;
    return this.#enabled === 'all' || this.#enabled.has(kind);
  }

  emit(input: EmitInput): void {
    if (!this.isEnabled(input.kind)) return;

    const event: TraceEvent = {
      ts: this.#now(),
      seq: this.#seq++,
      kind: input.kind,
      correlationId: input.correlationId,
      initiator: input.initiator,
      data: input.data ?? {},
    };

    // Redaction runs before any consumer sees the payload, buffer included.
    const redacted = this.#redaction ? this.#redaction(event) : event;

    if (this.#capacity > 0) {
      this.#buffer.push(redacted);
      while (this.#buffer.length > this.#capacity) {
        this.#buffer.shift();
        this.#dropped++;
      }
    }

    for (const sink of [...this.#sinks]) {
      try {
        sink(redacted);
      } catch {
        // A failing sink is the sink's problem. Observability never breaks the
        // thing it observes.
      }
    }
  }

  attach(sink: TraceSink): () => void {
    this.#sinks.add(sink);
    return () => {
      this.#sinks.delete(sink);
    };
  }

  setRedaction(hook: RedactionHook): void {
    this.#redaction = hook;
  }

  setEnabledKinds(kinds: readonly (TraceKind | string)[] | 'all'): void {
    this.#enabled = kinds === 'all' ? 'all' : new Set(kinds);
  }

  recent(count?: number): readonly TraceEvent[] {
    if (count === undefined) return [...this.#buffer];
    return this.#buffer.slice(Math.max(0, this.#buffer.length - count));
  }

  /**
   * The buffer as a serializable bundle — what you attach to a bug report, or
   * replay elsewhere to reconstruct what happened (OQ6).
   *
   * `dropped` matters: a bundle that silently lost its first thousand events
   * would have a consumer reconstructing a causal chain that never existed.
   */
  export(): TraceExport {
    return {
      workflowId: this.#workflowId,
      schemaVersion: this.#schemaVersion,
      capacity: this.#capacity,
      dropped: this.#dropped,
      events: [...this.#buffer],
    };
  }
}

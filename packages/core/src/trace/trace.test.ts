import { describe, expect, it, vi } from 'vitest';
import { TraceEmitter, type TraceEmitterOptions } from './emitter.js';
import { collectingSink, consoleSink, createRedaction } from './sinks.js';
import type { TraceEvent } from '../trace.js';

const base = { workflowId: 'wf', schemaVersion: '1.0.0', now: () => 1000 } as const;
const application = { kind: 'application' } as const;

function emitter(overrides: Partial<TraceEmitterOptions> = {}): TraceEmitter {
  return new TraceEmitter({ mode: 'development', ...base, ...overrides });
}

describe('the emitter costs nothing when nobody is listening (AD15)', () => {
  it('reports every kind disabled with no sink and no buffer', () => {
    const stream = emitter({ bufferSize: 0 });
    expect(stream.isEnabled('workflow.transition')).toBe(false);
    expect(stream.isEnabled('guard.evaluated')).toBe(false);
  });

  it('records nothing, and does not even advance the sequence', () => {
    const stream = emitter({ bufferSize: 0 });
    stream.emit({ kind: 'guard.evaluated', correlationId: 'co_1', initiator: application });
    expect(stream.recent()).toEqual([]);
    expect(stream.export().events).toEqual([]);

    // A sink attaching later starts at zero rather than inheriting a count of
    // events that were never built.
    const seen: TraceEvent[] = [];
    stream.attach(collectingSink(seen));
    stream.emit({ kind: 'workflow.transition', correlationId: 'co_1', initiator: application });
    expect(seen[0]?.seq).toBe(0);
  });

  it('wakes up the moment a sink attaches', () => {
    const stream = emitter({ bufferSize: 0 });
    expect(stream.isEnabled('workflow.transition')).toBe(false);
    stream.attach(() => undefined);
    expect(stream.isEnabled('workflow.transition')).toBe(true);
  });

  it('keeps a buffer in development, so recent() works without setup', () => {
    const stream = emitter();
    expect(stream.isEnabled('workflow.snapshot')).toBe(true);
  });

  it('keeps none in production, so an unobserved instance allocates nothing', () => {
    const stream = new TraceEmitter({ mode: 'production', ...base });
    expect(stream.isEnabled('workflow.snapshot')).toBe(false);
  });
});

describe('the stream stays ordered and filterable', () => {
  it('numbers events monotonically', () => {
    const seen: TraceEvent[] = [];
    const stream = emitter();
    stream.attach(collectingSink(seen));
    for (const kind of ['a', 'b', 'c']) {
      stream.emit({ kind, correlationId: 'co_1', initiator: application });
    }
    expect(seen.map((event) => event.seq)).toEqual([0, 1, 2]);
  });

  it('silences one kind without losing the others (OQ8)', () => {
    const seen: TraceEvent[] = [];
    const stream = emitter();
    stream.attach(collectingSink(seen));
    stream.setEnabledKinds(['workflow.transition', 'control.applied']);

    stream.emit({ kind: 'guard.evaluated', correlationId: 'co_1', initiator: application });
    stream.emit({ kind: 'workflow.transition', correlationId: 'co_1', initiator: application });

    expect(seen.map((event) => event.kind)).toEqual(['workflow.transition']);
  });

  it('survives a sink that throws, because observability never breaks its subject', () => {
    const seen: TraceEvent[] = [];
    const stream = emitter();
    stream.attach(() => {
      throw new Error('sink exploded');
    });
    stream.attach(collectingSink(seen));
    expect(() =>
      stream.emit({ kind: 'workflow.transition', correlationId: 'co_1', initiator: application }),
    ).not.toThrow();
    expect(seen).toHaveLength(1);
  });

  it('stops delivering after detach', () => {
    const seen: TraceEvent[] = [];
    const stream = emitter();
    const detach = stream.attach(collectingSink(seen));
    stream.emit({ kind: 'a', correlationId: 'co_1', initiator: application });
    detach();
    stream.emit({ kind: 'b', correlationId: 'co_1', initiator: application });
    expect(seen.map((event) => event.kind)).toEqual(['a']);
  });
});

describe('the ring buffer and its export (OQ6)', () => {
  it('holds the most recent events and counts what it dropped', () => {
    const stream = emitter({ bufferSize: 3 });
    for (let i = 0; i < 5; i += 1) {
      stream.emit({ kind: `k${i}`, correlationId: 'co_1', initiator: application });
    }
    expect(stream.recent().map((event) => event.kind)).toEqual(['k2', 'k3', 'k4']);
    expect(stream.recent(2).map((event) => event.kind)).toEqual(['k3', 'k4']);

    const bundle = stream.export();
    expect(bundle.dropped).toBe(2);
    expect(bundle.capacity).toBe(3);
    expect(bundle.workflowId).toBe('wf');
    expect(bundle.schemaVersion).toBe('1.0.0');
  });

  it('exports something a consumer can serialize and replay elsewhere', () => {
    const stream = emitter({ bufferSize: 10 });
    stream.emit({
      kind: 'control.applied',
      correlationId: 'co_1',
      initiator: application,
      data: { change: 'ch_1' },
    });
    const round = JSON.parse(JSON.stringify(stream.export())) as ReturnType<typeof stream.export>;
    expect(round.events[0]?.data['change']).toBe('ch_1');
  });
});

describe('redaction runs before any sink sees a payload', () => {
  const withContext = {
    kind: 'workflow.snapshot',
    correlationId: 'co_1',
    initiator: application,
    data: { context: { email: 'someone@example.com', tier: 'paid' }, node: 'hub' },
  } as const;

  it('development shows values, because a developer is reading their own stream', () => {
    const seen: TraceEvent[] = [];
    const stream = emitter({ redaction: createRedaction({ mode: 'development' }) });
    stream.attach(collectingSink(seen));
    stream.emit(withContext);
    expect((seen[0]?.data['context'] as Record<string, unknown>)['email']).toBe(
      'someone@example.com',
    );
  });

  it('production hides every context value by default', () => {
    const seen: TraceEvent[] = [];
    const stream = new TraceEmitter({
      mode: 'production',
      ...base,
      bufferSize: 5,
      redaction: createRedaction({ mode: 'production' }),
    });
    stream.attach(collectingSink(seen));
    stream.emit(withContext);
    const context = seen[0]?.data['context'] as Record<string, unknown>;
    expect(context['email']).toBe('[redacted]');
    expect(context['tier']).toBe('[redacted]');
    // Identifiers stay legible, so a redacted stream is still worth reading.
    expect(seen[0]?.data['node']).toBe('hub');
  });

  it('production keeps what an allow-list names', () => {
    const seen: TraceEvent[] = [];
    const stream = new TraceEmitter({
      mode: 'production',
      ...base,
      bufferSize: 5,
      redaction: createRedaction({ mode: 'production', allow: ['tier'] }),
    });
    stream.attach(collectingSink(seen));
    stream.emit(withContext);
    const context = seen[0]?.data['context'] as Record<string, unknown>;
    expect(context['tier']).toBe('paid');
    expect(context['email']).toBe('[redacted]');
  });

  it('redacts the buffer too, so export() cannot leak what a sink could not see', () => {
    const stream = new TraceEmitter({
      mode: 'production',
      ...base,
      bufferSize: 5,
      redaction: createRedaction({ mode: 'production' }),
    });
    stream.attach(() => undefined);
    stream.emit(withContext);
    const context = stream.export().events[0]?.data['context'] as Record<string, unknown>;
    expect(context['email']).toBe('[redacted]');
  });
});

describe('the console sink', () => {
  it('writes one line per event, naming the kind and the correlation', () => {
    const write = vi.fn();
    const stream = emitter();
    stream.attach(consoleSink(write));
    stream.emit({ kind: 'workflow.transition', correlationId: 'co_7', initiator: application });
    expect(write.mock.calls[0]?.[0]).toContain('workflow.transition');
    expect(write.mock.calls[0]?.[0]).toContain('co_7');
  });
});

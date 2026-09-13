import { bench, describe } from 'vitest';
import { createWorkflow } from '../workflow.js';
import { TraceEmitter } from './emitter.js';
import { referenceDocument, scenarioBundle, type ScenarioContext } from '../testing/scenario.js';
import type { WorkflowInstance } from '../workflow.js';

/**
 * What tracing costs when nobody is reading it (stage 7 exit criterion).
 *
 * Run with `pnpm bench`. The numbers are machine-specific; the ratios are the
 * point, and `docs/performance.md` records a run with the machine it came from.
 *
 * The property these numbers depend on is held by `observation-cost.test.ts`,
 * which fails rather than merely slows when a hot path starts building a
 * payload for a stream with no reader. Benchmarks measure; tests decide.
 */

const document = referenceDocument('workspace-onboarding');
const context = { tier: 'paid', actionTwoReady: true } as ScenarioContext;
const application = { kind: 'application' } as const;

function workflow(options: {
  mode: 'production' | 'development';
  sink?: boolean;
}): WorkflowInstance<ScenarioContext> {
  return createWorkflow<ScenarioContext>(document, scenarioBundle({ services: [] }), {
    mode: options.mode,
    initialContext: context,
    ...(options.sink === true ? { sinks: [() => undefined] } : {}),
  });
}

/**
 * One render pass: read the snapshot, then send an event the machine ignores.
 *
 * The ignored event is deliberate. It makes the interpreter publish without
 * changing anything, which is the shape of the cost being measured — the work
 * spent deciding whether there is something to report.
 */
function pass(instance: WorkflowInstance<ScenarioContext>): void {
  instance.getSnapshot();
  instance.send({ type: 'LEYLINE_BENCH_NOOP' });
}

describe('a render pass, by who is watching', () => {
  const unobserved = workflow({ mode: 'production' });
  const buffered = workflow({ mode: 'development' });
  const observed = workflow({ mode: 'development', sink: true });

  bench('unobserved — production, no sink, no buffer', () => pass(unobserved));
  bench('buffered — development ring buffer, no sink', () => pass(buffered));
  bench('observed — a sink on every kind', () => pass(observed));
});

describe('the emitter alone', () => {
  const base = { workflowId: 'wf', schemaVersion: '1.0.0' } as const;
  const unobserved = new TraceEmitter({ mode: 'production', ...base });
  const buffered = new TraceEmitter({ mode: 'development', ...base });
  const observed = new TraceEmitter({ mode: 'development', ...base });
  observed.attach(() => undefined);

  const input = {
    kind: 'guard.evaluated',
    correlationId: 'co_1',
    initiator: application,
    data: { guard: 'needsBilling', result: true },
  } as const;

  bench('emit — nothing attached, no buffer', () => unobserved.emit(input));
  bench('emit — into the ring buffer', () => buffered.emit(input));
  bench('emit — into one sink', () => observed.emit(input));

  // The check every hot path makes before it builds anything. If this is not
  // the cheapest line in the file, the design premise is wrong.
  bench('isEnabled — the check that guards the rest', () => {
    unobserved.isEnabled('guard.evaluated');
  });
});

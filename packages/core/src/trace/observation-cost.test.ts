import { describe, expect, it } from 'vitest';
import { createWorkflow } from '../workflow.js';
import { createEngine } from '../engine/xstate.js';
import { bindCapabilities } from '../binding.js';
import { parseWorkflow } from '@leyline/schema';
import {
  referenceDocument,
  scenarioBundle,
  settle,
  type ScenarioContext,
} from '../testing/scenario.js';
import type { EngineObserver } from '../engine/facade.js';
import type { WorkflowDocument } from '@leyline/schema';

/**
 * What "unobserved tracing costs nothing" means, stated so a regression fails
 * rather than merely getting slower (AD15, stage 7 exit criterion).
 *
 * The benchmark in `observation-cost.bench.ts` reports the number. These tests
 * hold the property the number depends on, because a benchmark that drifts by
 * 30% is a judgement call and a test that goes red is not.
 *
 * Two claims, and they are separate:
 *
 * 1. **The emitter constructs nothing.** `now()` is called exactly once per
 *    event the emitter builds, so a run in which it is never called is a run in
 *    which no envelope, no timestamp, and no sequence number came into being.
 * 2. **Callers assemble nothing to hand it.** The emitter cannot help here —
 *    by the time `emit` can refuse, its argument already exists. So every hot
 *    path asks `isEnabled` first, and the engine hot paths are covered by an
 *    observer that treats being called at all as the failure.
 */

const document = referenceDocument('workspace-onboarding');

function countingNow(): { now: () => number; calls: () => number } {
  let calls = 0;
  return {
    now: () => {
      calls += 1;
      return 1_000 + calls;
    },
    calls: () => calls,
  };
}

async function drive(mode: 'production' | 'development', sinkAttached: boolean) {
  const clock = countingNow();
  const workflow = createWorkflow<ScenarioContext>(document, scenarioBundle({ services: [] }), {
    mode,
    now: clock.now,
    ...(sinkAttached ? { sinks: [() => undefined] } : {}),
    initialContext: { tier: 'free', actionTwoReady: false } as ScenarioContext,
  });
  workflow.send({ type: 'CREATE' });
  await settle();
  for (let i = 0; i < 50; i += 1) {
    workflow.getSnapshot();
    workflow.send({ type: 'NOOP_EVENT_THAT_MATCHES_NOTHING' });
  }
  return clock;
}

describe('unobserved tracing builds nothing (AD15)', () => {
  it('never asks the clock what time it is, across a full scenario run', async () => {
    const clock = await drive('production', false);
    expect(clock.calls()).toBe(0);
  });

  it('asks once per event as soon as something is listening, so the count means something', async () => {
    const clock = await drive('production', true);
    expect(clock.calls()).toBeGreaterThan(0);
  });

  it('keeps a development buffer fed even with no sink, because recent() has to work', async () => {
    const clock = await drive('development', false);
    expect(clock.calls()).toBeGreaterThan(0);
  });
});

/**
 * The engine's two hot paths. Both take an argument that costs something to
 * build — a guard result, and the active tree flattened twice and compared —
 * so both have to be asked before they are told.
 */
describe('the engine asks before it assembles', () => {
  const parsed = parseWorkflow(document).document as WorkflowDocument;

  function silentObserver(): { observer: EngineObserver; asked: string[] } {
    const asked: string[] = [];
    const refuse = (method: string) => () => {
      throw new Error(
        `The engine called ${method} while tracing was off. Something built its argument first.`,
      );
    };
    return {
      asked,
      observer: {
        tracingEnabled: (kind) => {
          asked.push(kind);
          return false;
        },
        onTransition: refuse('onTransition'),
        onGuard: refuse('onGuard'),
        // Service observation is per invocation rather than per render pass, and
        // its payload is two strings already in hand, so it is not on this list.
        onServiceInvoked: () => undefined,
        onServiceSettled: () => undefined,
      },
    };
  }

  it('describes no transition while the stream has no reader', async () => {
    const { observer, asked } = silentObserver();
    const engine = createEngine<ScenarioContext>({
      document: parsed,
      capabilities: bindCapabilities(parsed, scenarioBundle({ services: [] })),
      initialContext: { tier: 'free', actionTwoReady: false } as ScenarioContext,
      observer,
    });

    engine.start();
    engine.send({ type: 'CREATE' });
    await settle();
    engine.stop();

    // The point is the pairing: it was asked, and having been told no, it did
    // not go on to flatten the tree.
    expect(asked).toContain('workflow.transition');
  });

  it('evaluates no guard for the trace stream while the stream has no reader', async () => {
    const { observer, asked } = silentObserver();
    const engine = createEngine<ScenarioContext>({
      document: parsed,
      capabilities: bindCapabilities(parsed, scenarioBundle({ services: [] })),
      initialContext: { tier: 'paid', actionTwoReady: true } as ScenarioContext,
      observer,
    });

    engine.start();
    engine.send({ type: 'CREATE' });
    await settle();
    engine.send({ type: 'RUN_TWO' });
    await settle();
    engine.stop();

    expect(asked).toContain('guard.evaluated');
  });
});

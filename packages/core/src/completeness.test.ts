import { describe, expect, it } from 'vitest';
import { createWorkflow } from './workflow.js';
import { activeSurfaces } from './contracts.js';
import {
  referenceDocument,
  scenarioBundle,
  settle,
  type ScenarioContext,
} from './testing/scenario.js';
import type { CapabilityBundle } from './contracts.js';
import type { TraceEvent } from './trace.js';

/**
 * "Every state change emits a trace event" is a constraint in brief §8, not an
 * aspiration. These tests are the harness that holds it: they drive known
 * scenarios and assert the stream accounts for everything that happened.
 */

const document = referenceDocument('workspace-onboarding');

async function run(context: Partial<ScenarioContext>): Promise<{
  events: TraceEvent[];
  visited: string[];
  workflow: ReturnType<typeof createWorkflow<ScenarioContext>>;
}> {
  const events: TraceEvent[] = [];
  const visited: string[] = [];
  const workflow = createWorkflow<ScenarioContext>(document, scenarioBundle({ services: [] }), {
    mode: 'development',
    sinks: [(event) => events.push(event)],
    initialContext: { tier: 'free', actionTwoReady: true, ...context } as ScenarioContext,
  });
  workflow.subscribe(() => {
    const id = workflow.getSnapshot().root.id;
    if (visited[visited.length - 1] !== id) visited.push(id);
  });
  await settle();
  return { events, visited, workflow };
}

const kinds = (events: TraceEvent[]): string[] => events.map((event) => event.kind);
const compareText = (a: string, b: string): number => a.localeCompare(b);

describe('the stream accounts for everything that happened', () => {
  it('reports binding once, before anything runs', async () => {
    const events: TraceEvent[] = [];
    const workflow = createWorkflow<ScenarioContext>(document, scenarioBundle({ services: [] }), {
      mode: 'development',
      bufferSize: 50,
      sinks: [(event) => events.push(event)],
      initialContext: { tier: 'paid', actionTwoReady: false },
    });
    await settle();

    const bound = workflow.trace.recent().filter((event) => event.kind === 'workflow.bound');
    expect(bound).toHaveLength(1);
    expect(bound[0]?.seq).toBe(0);
    expect(bound[0]?.data).toMatchObject({ workflow: 'workspace-onboarding', guards: 2 });
  });

  it('emits a transition for every node the snapshot actually visited', async () => {
    const { events, visited } = await run({ tier: 'paid' });
    const announced = events
      .filter((event) => event.kind === 'workflow.transition')
      .flatMap((event) => event.data['to'] as string[]);

    for (const node of visited.slice(1)) {
      expect(announced, `no transition event announced "${node}"`).toContain(node);
    }
  });

  it('emits an invocation and a settlement for every service call', async () => {
    const { events } = await run({ tier: 'paid' });
    const invoked = events
      .filter((e) => e.kind === 'service.invoked')
      .map((e) => e.data['service']);
    const settled = events
      .filter((e) => e.kind === 'service.settled')
      .map((e) => e.data['service']);
    expect(invoked).toEqual(settled);
    expect(invoked).toContain('createWorkspace');
    expect(invoked).toContain('submitBilling');
  });

  it('reports a failing service as settled with an error rather than silence', async () => {
    const events: TraceEvent[] = [];
    const bundle = scenarioBundle({ services: [] }) as unknown as {
      services: Record<string, unknown>;
    };
    bundle.services['createWorkspace'] = async () => {
      throw new Error('the API said no');
    };
    const workflow = createWorkflow<ScenarioContext>(document, bundle as CapabilityBundle, {
      mode: 'development',
      sinks: [(event) => events.push(event)],
      initialContext: { tier: 'free', actionTwoReady: false },
    });
    await settle();

    expect(events.find((event) => event.kind === 'service.settled')?.data['outcome']).toBe('error');
    expect(workflow.getSnapshot().root.id).toBe('create-workspace-failed');
  });

  it('publishes a snapshot event for every published snapshot', async () => {
    const { events, workflow } = await run({ tier: 'free' });
    let published = 0;
    workflow.subscribe(() => {
      published += 1;
    });
    const before = events.filter((e) => e.kind === 'workflow.snapshot').length;

    workflow.send({ type: 'noop' });
    await settle();

    const after = events.filter((e) => e.kind === 'workflow.snapshot').length;
    expect(after - before).toBe(published);
  });

  it('covers every kind the §2 scenario can produce', async () => {
    const { events } = await run({ tier: 'paid' });
    for (const kind of [
      'workflow.bound',
      'workflow.transition',
      'workflow.snapshot',
      'guard.evaluated',
      'service.invoked',
      'service.settled',
    ]) {
      expect(kinds(events), `nothing emitted ${kind}`).toContain(kind);
    }
  });
});

describe('correlation ties a causal chain together (AD15)', () => {
  it('gives everything one user event caused the same correlation identifier', async () => {
    const { events, workflow } = await run({ tier: 'free', actionTwoReady: true });
    const before = events.length;

    const link = activeSurfaces(workflow.getSnapshot().root).find((s) => s.id === 'to-action-two');
    (link?.getters['link']?.() as { onActivate: () => void }).onActivate();
    await settle();

    const caused = events.slice(before);
    expect(caused.length).toBeGreaterThan(3);
    expect(new Set(caused.map((event) => event.correlationId)).size).toBe(1);
  });

  it('gives a later user event a different one, so chains do not merge', async () => {
    const { events, workflow } = await run({ tier: 'free' });
    workflow.send({ type: 'first' });
    await settle();
    const firstId = events[events.length - 1]?.correlationId;

    workflow.send({ type: 'second' });
    await settle();
    const secondId = events[events.length - 1]?.correlationId;

    expect(firstId).not.toBe(secondId);
  });

  it('attributes every event to an initiator', async () => {
    const { events } = await run({ tier: 'paid' });
    expect(events.every((event) => event.initiator.kind === 'application')).toBe(true);
  });
});

describe('events stay small enough to leave on (brief §8)', () => {
  it('keeps every payload under a few hundred bytes', async () => {
    const { events } = await run({ tier: 'paid' });
    for (const event of events) {
      const size = JSON.stringify(event).length;
      expect(size, `${event.kind} serialized to ${size} bytes`).toBeLessThan(400);
    }
  });

  it('references things by identifier rather than embedding them', async () => {
    const { events } = await run({ tier: 'paid' });
    const snapshot = events.find((event) => event.kind === 'workflow.snapshot');
    // A snapshot event names the node and counts the regions; it never carries
    // the surfaces, the data, or the context.
    expect([...Object.keys(snapshot?.data ?? {})].sort(compareText)).toEqual([
      'node',
      'regions',
      'status',
    ]);
  });
});

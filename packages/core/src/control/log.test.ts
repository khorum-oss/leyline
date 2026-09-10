import { describe, expect, it } from 'vitest';
import { createWorkflow } from '../workflow.js';
import {
  referenceDocument,
  scenarioBundle,
  settle,
  type ScenarioContext,
} from '../testing/scenario.js';
import type { Initiator } from '@leyline/schema';
import type { TraceEvent } from '../trace.js';

/**
 * The audit trail cannot drift from reality (brief §8).
 *
 * AD15 describes the change log as a projection of the trace stream. The stream
 * is bounded and, in production, may not be retained at all, so the log is kept
 * alongside it rather than computed from it — which makes "they agree" a
 * property to test rather than one the structure guarantees. These are that
 * test (decision 0029).
 */

const document = referenceDocument('workspace-onboarding');
const agent: Initiator = { kind: 'agent', label: 'auditor' };

function start(): {
  workflow: ReturnType<typeof createWorkflow<ScenarioContext>>;
  events: TraceEvent[];
} {
  const events: TraceEvent[] = [];
  const workflow = createWorkflow<ScenarioContext>(document, scenarioBundle({ services: [] }), {
    mode: 'development',
    sinks: [(event) => events.push(event)],
    initialContext: { tier: 'free', actionTwoReady: true },
  });
  return { workflow, events };
}

/** The change log as a reader would rebuild it from the stream alone. */
function logFromStream(events: readonly TraceEvent[]): string[] {
  return events
    .filter((event) => event.kind === 'control.applied' || event.kind === 'control.reverted')
    .map((event) => event.data['change'] as string);
}

describe('the log and the stream agree', () => {
  it('records exactly what the stream announced, in the same order', async () => {
    const { workflow, events } = start();
    await settle();

    for (const tier of ['paid', 'organization', 'free']) {
      await workflow.control.apply(
        await workflow.control.propose({ kind: 'context.patch', values: { tier } }, agent),
      );
    }

    expect(logFromStream(events)).toEqual(workflow.control.log().map((record) => record.id));
  });

  it('announces a revert as its own entry, and marks what it undid', async () => {
    const { workflow, events } = start();
    await settle();
    const record = await workflow.control.apply(
      await workflow.control.propose({ kind: 'context.patch', values: { tier: 'paid' } }, agent),
    );
    const undo = await workflow.control.revert(record.id);

    expect(logFromStream(events)).toEqual([record.id, undo.id]);
    expect(workflow.control.log().find((r) => r.id === record.id)?.revertedBy).toBe(undo.id);
    expect(events.find((event) => event.kind === 'control.reverted')?.data['reverted']).toBe(
      record.id,
    );
  });

  it('announces nothing for a change that never applied', async () => {
    const { workflow, events } = start();
    await settle();
    const proposal = await workflow.control.propose(
      { kind: 'context.patch', values: { adminToken: 'x' } },
      agent,
    );
    await workflow.control.validate(proposal);

    expect(logFromStream(events)).toEqual([]);
    expect(workflow.control.log()).toEqual([]);
    // The attempt is still on the record, which is the point of tracing it.
    expect(events.map((event) => event.kind)).toContain('control.proposed');
  });

  it('replaying a recorded log against a fresh instance reproduces the same state', async () => {
    const first = start();
    await settle();
    for (const tier of ['paid', 'organization']) {
      await first.workflow.control.apply(
        await first.workflow.control.propose({ kind: 'context.patch', values: { tier } }, agent),
      );
    }
    const persisted = JSON.parse(JSON.stringify(first.workflow.control.log()));

    const second = start();
    await settle();
    await second.workflow.control.hydrate(persisted);

    expect(second.workflow.getSnapshot().context.tier).toBe(
      first.workflow.getSnapshot().context.tier,
    );
  });
});

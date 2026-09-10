import { describe, expect, it } from 'vitest';
import { createWorkflow, type WorkflowInstance } from '../workflow.js';
import { activeSurfaces } from '../contracts.js';
import { allowKinds, denyAll, forInitiator, permissive, requireConfirmation } from './policy.js';
import {
  referenceDocument,
  scenarioBundle,
  settle,
  type ScenarioContext,
} from '../testing/scenario.js';
import type { Initiator } from '@leyline/schema';
import type { RendererDefinition } from '../registry.js';
import type { TraceEvent } from '../trace.js';

const document = referenceDocument('workspace-onboarding');
const agent: Initiator = { kind: 'agent', label: 'card-grid-swap' };
const viewer: Initiator = { kind: 'user', label: 'viewer-4821' };

/** What the application published. An initiator may name these and nothing else. */
const catalogue: RendererDefinition[] = [
  { id: 'DataTable', description: 'A table of rows.', claims: ['datatable'], component: '<table>' },
  {
    id: 'CardGrid',
    description: 'The same rows as a grid of cards.',
    claims: ['datatable'],
    component: '<cards>',
  },
  { id: 'MetricPanel', claims: ['metric-panel'], component: '<metrics>' },
];

interface Harness {
  workflow: WorkflowInstance<ScenarioContext>;
  events: TraceEvent[];
}

function start(options: Partial<Parameters<typeof createWorkflow>[2]> = {}): Harness {
  const events: TraceEvent[] = [];
  const workflow = createWorkflow<ScenarioContext>(document, scenarioBundle({ services: [] }), {
    mode: 'development',
    renderers: catalogue,
    sinks: [(event: TraceEvent) => events.push(event)],
    initialContext: { tier: 'free', actionTwoReady: true },
    ...options,
  } as never);
  return { workflow, events };
}

const surfaceIn = (h: Harness, id: string) =>
  activeSurfaces(h.workflow.getSnapshot().root).find((surface) => surface.id === id);

describe('the §2 agent scenario, item 6: swap the actions table for a card grid', () => {
  it('describe() names the surface and its renderer without touching application source', async () => {
    const h = start();
    await settle();
    await h.workflow.control.apply(
      await h.workflow.control.propose(
        {
          kind: 'renderer.register',
          registry: 'default',
          renderer: 'DataTable',
          match: { surfaceType: 'datatable' },
          rank: 10,
        },
        { kind: 'application' },
      ),
    );

    const described = h.workflow.control.describe();
    const actions = described.surfaces.find((surface) => surface.id === 'actions');
    expect(actions).toMatchObject({
      nodeId: 'workspace-hub',
      type: 'datatable',
      renderer: 'DataTable',
    });
    // Introspection reads like documentation, so an agent can reason about it.
    expect(actions?.description).toContain('table of available actions');
  });

  it('is two calls: describe, then apply a higher-ranked registration', async () => {
    const h = start();
    await settle();
    await h.workflow.control.apply(
      await h.workflow.control.propose(
        {
          kind: 'renderer.register',
          registry: 'default',
          renderer: 'DataTable',
          match: { surfaceType: 'datatable' },
          rank: 10,
        },
        { kind: 'application' },
      ),
    );

    const proposal = await h.workflow.control.propose(
      {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'CardGrid',
        match: { surfaceId: 'actions' },
        rank: 80,
      },
      agent,
    );
    expect((await h.workflow.control.validate(proposal)).ok).toBe(true);
    const record = await h.workflow.control.apply(proposal);

    const actions = surfaceIn(h, 'actions');
    expect(h.workflow.resolve(actions as never)?.renderer).toBe('CardGrid');
    // The generic table still claims every other datatable.
    expect(h.workflow.control.describe().registries[0]?.entries).toBe(2);
    expect(record.initiator).toEqual(agent);
  });

  it('reverting is one more call, and the table comes back', async () => {
    const h = start();
    await settle();
    await h.workflow.control.apply(
      await h.workflow.control.propose(
        {
          kind: 'renderer.register',
          registry: 'default',
          renderer: 'DataTable',
          match: { surfaceType: 'datatable' },
          rank: 10,
        },
        { kind: 'application' },
      ),
    );
    const swap = await h.workflow.control.apply(
      await h.workflow.control.propose(
        {
          kind: 'renderer.register',
          registry: 'default',
          renderer: 'CardGrid',
          match: { surfaceId: 'actions' },
          rank: 80,
        },
        agent,
      ),
    );

    await h.workflow.control.revert(swap.id);
    expect(h.workflow.resolve(surfaceIn(h, 'actions') as never)?.renderer).toBe('DataTable');
    expect(h.workflow.control.log().find((r) => r.id === swap.id)?.revertedBy).toBeDefined();
  });

  it('refuses a renderer the application never published (I3)', async () => {
    const h = start();
    await settle();
    const proposal = await h.workflow.control.propose(
      {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'SomethingElse',
        match: { surfaceId: 'actions' },
        rank: 90,
      },
      agent,
    );
    const result = await h.workflow.control.validate(proposal);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.rule).toBe('renderer.undiscoverable');
    expect(result.issues[0]?.suggestion).toContain('CardGrid');
  });

  it('refuses a renderer that does not claim the surface type', async () => {
    const h = start();
    await settle();
    const proposal = await h.workflow.control.propose(
      {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'MetricPanel',
        match: { surfaceType: 'datatable' },
        rank: 90,
      },
      agent,
    );
    expect((await h.workflow.control.validate(proposal)).issues[0]?.rule).toBe(
      'renderer.does-not-claim',
    );
  });
});

describe('the §2 agent scenario, item 7: hide the metrics panel for free tiers', () => {
  it('attaches a guard to the surface, and the panel disappears without a rebuild', async () => {
    const h = start();
    await settle();
    expect(surfaceIn(h, 'metrics')).toBeDefined();

    const proposal = await h.workflow.control.propose(
      {
        kind: 'surface.attach-guard',
        node: 'workspace-hub',
        surface: 'metrics',
        guard: 'needsBilling',
      },
      agent,
    );
    expect((await h.workflow.control.validate(proposal)).ok).toBe(true);
    await h.workflow.control.apply(proposal);

    // Free tier: needsBilling is false, so the panel is gone. The hub did not
    // restart — everything else is exactly where it was.
    expect(surfaceIn(h, 'metrics')).toBeUndefined();
    expect(h.workflow.getSnapshot().root.id).toBe('workspace-hub');
    expect(surfaceIn(h, 'actions')).toBeDefined();
  });

  it('refuses a guard the workflow never declared (I2)', async () => {
    const h = start();
    await settle();
    const proposal = await h.workflow.control.propose(
      {
        kind: 'surface.attach-guard',
        node: 'workspace-hub',
        surface: 'metrics',
        guard: 'isSecretlyAdmin',
      },
      agent,
    );
    const result = await h.workflow.control.validate(proposal);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.rule).toBe('capability.undeclared');
  });

  it('the change is observable on the same stream the agent already reads', async () => {
    const h = start();
    await settle();
    const before = h.events.length;
    await h.workflow.control.apply(
      await h.workflow.control.propose(
        {
          kind: 'surface.attach-guard',
          node: 'workspace-hub',
          surface: 'metrics',
          guard: 'needsBilling',
        },
        agent,
      ),
    );
    const emitted = h.events.slice(before).map((event) => event.kind);
    expect(emitted).toContain('control.proposed');
    expect(emitted).toContain('control.policy');
    expect(emitted).toContain('control.validated');
    expect(emitted).toContain('control.applied');
  });
});

describe('policy is consulted first and cannot be bypassed (I6)', () => {
  it('denies before validation even runs', async () => {
    const h = start({ policy: denyAll });
    await settle();
    const proposal = await h.workflow.control.propose(
      {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'CardGrid',
        match: { surfaceId: 'actions' },
        rank: 80,
      },
      agent,
    );
    const result = await h.workflow.control.validate(proposal);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.rule)).toEqual(['policy.denied']);
    await expect(h.workflow.control.apply(proposal)).rejects.toThrow(/denied by policy/);
  });

  it('applies to application code too — there is no privileged initiator', async () => {
    const h = start({ policy: denyAll });
    await settle();
    const proposal = await h.workflow.control.propose(
      { kind: 'context.patch', values: { tier: 'paid' } },
      { kind: 'application' },
    );
    expect((await h.workflow.control.validate(proposal)).ok).toBe(false);
  });

  it('applies to revert as well', async () => {
    const h = start();
    await settle();
    const applied = await h.workflow.control.apply(
      await h.workflow.control.propose(
        { kind: 'context.patch', values: { tier: 'paid' } },
        { kind: 'application' },
      ),
    );

    const locked = start({ policy: allowKinds('context.patch') });
    await settle();
    await locked.workflow.control.apply(
      await locked.workflow.control.propose(
        { kind: 'context.patch', values: { tier: 'paid' } },
        { kind: 'application' },
      ),
    );
    const record = locked.workflow.control.log()[0];
    await expect(locked.workflow.control.revert(record?.id as string)).rejects.toThrow(
      /not among the permitted change kinds/,
    );
    expect(applied.id).toBeDefined();
  });

  it('lets an application say "viewers may reorder, never touch guards"', async () => {
    const policy = forInitiator(
      'user',
      allowKinds('section.reorder-children', 'section.move-child'),
    );
    const h = start({ policy });
    await settle();

    const guard = await h.workflow.control.propose(
      {
        kind: 'surface.attach-guard',
        node: 'workspace-hub',
        surface: 'metrics',
        guard: 'needsBilling',
      },
      viewer,
    );
    expect((await h.workflow.control.validate(guard)).ok).toBe(false);

    // The same change from the application is fine, because the rule named a
    // viewer rather than a change kind.
    const fromApp = await h.workflow.control.propose(
      {
        kind: 'surface.attach-guard',
        node: 'workspace-hub',
        surface: 'metrics',
        guard: 'needsBilling',
      },
      { kind: 'application' },
    );
    expect((await h.workflow.control.validate(fromApp)).ok).toBe(true);
  });

  it('production with no policy refuses agents and viewers, and allows the application', async () => {
    const h = start({ mode: 'production' });
    await settle();
    for (const initiator of [agent, viewer]) {
      const proposal = await h.workflow.control.propose(
        { kind: 'context.patch', values: { tier: 'paid' } },
        initiator,
      );
      const result = await h.workflow.control.validate(proposal);
      expect(result.ok, `${initiator.kind} should be refused`).toBe(false);
      expect(result.issues[0]?.message).toContain('no configured policy');
    }
    const own = await h.workflow.control.propose(
      { kind: 'context.patch', values: { tier: 'paid' } },
      { kind: 'application' },
    );
    expect((await h.workflow.control.validate(own)).ok).toBe(true);
  });
});

describe('confirmation (OQ4)', () => {
  it('holds a proposal pending until someone resolves it', async () => {
    const h = start({ policy: requireConfirmation('An adult should look at this.') });
    await settle();
    const proposal = await h.workflow.control.propose(
      { kind: 'context.patch', values: { tier: 'paid' } },
      agent,
    );

    expect(h.workflow.control.pending().map((p) => p.id)).toEqual([proposal.id]);
    await expect(h.workflow.control.apply(proposal)).rejects.toThrow(/awaiting confirmation/);

    const result = await h.workflow.control.validate(proposal);
    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => issue.rule)).toContain('policy.confirmation-required');

    expect(h.workflow.control.confirm(proposal.id)).toBe(true);
    await expect(h.workflow.control.apply(proposal)).resolves.toBeDefined();
    expect(h.workflow.control.pending()).toEqual([]);
  });

  it('cancelling refuses the proposal for good', async () => {
    const h = start({ policy: requireConfirmation('Check first.') });
    await settle();
    const proposal = await h.workflow.control.propose(
      { kind: 'context.patch', values: { tier: 'paid' } },
      agent,
    );
    expect(h.workflow.control.cancel(proposal.id)).toBe(true);
    await expect(h.workflow.control.apply(proposal)).rejects.toThrow(/cancelled/);
  });
});

describe('proposals are pure data and applying twice is a no-op', () => {
  it('returns the same record rather than applying again', async () => {
    const h = start({ policy: permissive });
    await settle();
    const proposal = await h.workflow.control.propose(
      { kind: 'context.patch', values: { tier: 'paid' } },
      agent,
    );
    const first = await h.workflow.control.apply(proposal);
    const second = await h.workflow.control.apply(proposal);
    expect(second).toBe(first);
    expect(h.workflow.control.log()).toHaveLength(1);
  });

  it('answers a malformed change with structured issues rather than an exception', async () => {
    const h = start();
    await settle();
    const proposal = await h.workflow.control.propose(
      {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'CardGrid',
        match: {},
        rank: 5000,
      },
      agent,
    );
    const result = await h.workflow.control.validate(proposal);
    expect(result.ok).toBe(false);
    expect(result.issues.every((issue) => issue.rule === 'change.invalid')).toBe(true);
  });
});

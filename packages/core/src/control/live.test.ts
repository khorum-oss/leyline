import { describe, expect, it } from 'vitest';
import { createWorkflow, type WorkflowInstance } from '../workflow.js';
import { walkRegions, type ActiveRegion } from '../contracts.js';
import { referenceDocument, settle } from '../testing/scenario.js';
import type { CapabilityBundle } from '../contracts.js';
import type { Initiator } from '@leyline/schema';
import type { TraceEvent } from '../trace.js';

/**
 * What happens to a running workflow when a change alters its state graph
 * (decision 0025), and how revert restores it (decision 0026).
 */

const document = referenceDocument('personal-dashboard');
const viewer: Initiator = { kind: 'user', label: 'viewer-4821' };

interface DashboardContext extends Record<string, unknown> {
  readonly viewer: Record<string, unknown>;
  readonly showsActivity: boolean;
  readonly selectedItem?: string;
}

function bundle(): CapabilityBundle {
  return {
    guards: { keepsActivityFeed: (c: DashboardContext) => c.showsActivity === true },
    services: { loadItem: async () => 'item_42' },
    dataSources: {
      navigationItems: () => [],
      summaryMetrics: () => ({}),
      activityFeed: () => [],
      itemDetail: () => ({}),
    },
  } as CapabilityBundle;
}

function start(): { workflow: WorkflowInstance<DashboardContext>; events: TraceEvent[] } {
  const events: TraceEvent[] = [];
  const workflow = createWorkflow<DashboardContext>(document, bundle(), {
    mode: 'development',
    sinks: [(event) => events.push(event)],
    initialContext: { viewer: {}, showsActivity: true },
  });
  return { workflow, events };
}

/** Two containers that both run everything, and a leaf a viewer can move. */
const movable = {
  leylineVersion: '1.0.0',
  id: 'movable-page',
  name: 'Movable page',
  entry: 'page',
  nodes: [
    { id: 'page', kind: 'section', mode: 'many', children: ['left', 'right'] },
    { id: 'left', kind: 'section', mode: 'many', children: ['alpha'] },
    { id: 'right', kind: 'section', mode: 'many', children: ['beta'] },
    { id: 'alpha', kind: 'hub', surfaces: [{ id: 'alpha-text', type: 'text' }] },
    { id: 'beta', kind: 'hub', surfaces: [{ id: 'beta-text', type: 'text' }] },
  ],
};

function startMovable(): { workflow: WorkflowInstance<DashboardContext>; events: TraceEvent[] } {
  const events: TraceEvent[] = [];
  const workflow = createWorkflow<DashboardContext>(movable, {} as CapabilityBundle, {
    mode: 'development',
    sinks: [(event) => events.push(event)],
    initialContext: { viewer: {}, showsActivity: true },
  });
  return { workflow, events };
}

const childrenOf = (root: ActiveRegion, id: string): string[] =>
  [...walkRegions(root)].find((region) => region.id === id)?.children.map((c) => c.id) ?? [];

describe('presentation changes apply live, with no rebuild', () => {
  it('reordering a section changes reading order and nothing else', async () => {
    const { workflow } = start();
    await settle();
    const before = workflow.getSnapshot().root.children.map((child) => child.id);
    expect(before).toEqual(['navigation', 'workspace', 'activity']);

    await workflow.control.apply(
      await workflow.control.propose(
        {
          kind: 'section.reorder-children',
          node: 'dashboard',
          children: ['activity', 'navigation', 'workspace'],
        },
        viewer,
      ),
    );

    expect(workflow.getSnapshot().root.children.map((child) => child.id)).toEqual([
      'activity',
      'navigation',
      'workspace',
    ]);
    // Nothing restarted: the workspace region is still where it was.
    expect(childrenOf(workflow.getSnapshot().root, 'workspace')).toEqual(['workspace-overview']);
  });

  it('refuses a reorder that adds or drops a child', async () => {
    const { workflow } = start();
    await settle();
    const proposal = await workflow.control.propose(
      { kind: 'section.reorder-children', node: 'dashboard', children: ['navigation'] },
      viewer,
    );
    const result = await workflow.control.validate(proposal);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.rule).toBe('section.not-a-permutation');
  });
});

describe('graph changes rebuild the interpreter and keep the viewer where they were', () => {
  it('moves a region between containers', async () => {
    const { workflow } = startMovable();
    await settle();
    expect(childrenOf(workflow.getSnapshot().root, 'left')).toEqual(['alpha']);

    await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'section.move-child', child: 'alpha', from: 'left', to: 'right' },
        viewer,
      ),
    );

    expect(childrenOf(workflow.getSnapshot().root, 'left')).toEqual([]);
    expect(childrenOf(workflow.getSnapshot().root, 'right')).toEqual(['beta', 'alpha']);
  });

  it('honours the index a viewer dropped it at', async () => {
    const { workflow } = startMovable();
    await settle();
    await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'section.move-child', child: 'alpha', from: 'left', to: 'right', index: 0 },
        viewer,
      ),
    );
    expect(childrenOf(workflow.getSnapshot().root, 'right')).toEqual(['alpha', 'beta']);
  });

  it('reports the impact on the stream, so nothing is silent', async () => {
    const { workflow, events } = startMovable();
    await settle();
    const before = events.length;
    await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'section.move-child', child: 'alpha', from: 'left', to: 'right' },
        viewer,
      ),
    );
    const applied = events.slice(before).find((event) => event.kind === 'control.applied');
    expect(applied?.data['impact']).toBe('graph');
  });

  it('keeps the interpreter where it was rather than returning to the entry', async () => {
    const { workflow } = start();
    await settle();
    const link = [...walkRegions(workflow.getSnapshot().root)]
      .flatMap((region) => region.surfaces)
      .find((surface) => surface.id === 'to-detail');
    (link?.getters['link']?.() as { onActivate: () => void }).onActivate();
    await settle();
    expect(childrenOf(workflow.getSnapshot().root, 'workspace')).toEqual(['workspace-detail']);

    // A graph-level change on a different part of the page rebuilds the
    // interpreter; the workspace region must not lose its place.
    await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'workflow.replace', document: workflow.document },
        viewer,
      ),
    );
    expect(childrenOf(workflow.getSnapshot().root, 'workspace')).toEqual(['workspace-detail']);
  });

  it('refuses a move that would break the graph', async () => {
    const { workflow } = startMovable();
    await settle();
    const proposal = await workflow.control.propose(
      { kind: 'section.move-child', child: 'left', from: 'page', to: 'left' },
      viewer,
    );
    const result = await workflow.control.validate(proposal);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.rule)).toContain('graph.containment-cycle');
  });

  it('refuses a move that would orphan the region it moves', async () => {
    // `workspace` runs one child at a time and nothing transitions to a moved-in
    // region, so it would become unreachable. Validation says so rather than
    // producing a page with a panel nobody can get to.
    const { workflow } = start();
    await settle();
    const proposal = await workflow.control.propose(
      { kind: 'section.move-child', child: 'activity', from: 'dashboard', to: 'workspace' },
      viewer,
    );
    const result = await workflow.control.validate(proposal);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.rule)).toContain('graph.unreachable-node');
  });
});

describe('revert replays the log without the reverted change (AD11)', () => {
  it('restores what the change altered', async () => {
    const { workflow } = start();
    await settle();
    const record = await workflow.control.apply(
      await workflow.control.propose(
        {
          kind: 'section.reorder-children',
          node: 'dashboard',
          children: ['activity', 'navigation', 'workspace'],
        },
        viewer,
      ),
    );

    await workflow.control.revert(record.id);
    expect(workflow.document.nodes.find((n) => n.id === 'dashboard')?.children).toEqual([
      'navigation',
      'workspace',
      'activity',
    ]);
  });

  it('keeps later changes, replaying them against the restored state', async () => {
    const { workflow } = start();
    await settle();
    const first = await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'context.patch', values: { showsActivity: false } },
        viewer,
      ),
    );
    await workflow.control.apply(
      await workflow.control.propose(
        {
          kind: 'section.reorder-children',
          node: 'dashboard',
          children: ['activity', 'navigation', 'workspace'],
        },
        viewer,
      ),
    );

    await workflow.control.revert(first.id);

    // The later reorder survived; only the reverted change is gone.
    expect(workflow.document.nodes.find((n) => n.id === 'dashboard')?.children).toEqual([
      'activity',
      'navigation',
      'workspace',
    ]);
  });

  it('refuses when a later change would no longer validate, and says which', async () => {
    const { workflow } = startMovable();
    await settle();
    const move = await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'section.move-child', child: 'alpha', from: 'left', to: 'right' },
        viewer,
      ),
    );
    await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'section.reorder-children', node: 'right', children: ['alpha', 'beta'] },
        viewer,
      ),
    );

    // Reverting the move would leave the reorder naming a child that is no
    // longer there, which is exactly the case AD11 asks to be explained.
    await expect(workflow.control.revert(move.id)).rejects.toThrow(
      /would leave later changes invalid/,
    );
  });

  it('reverting a revert restores the change', async () => {
    const { workflow } = start();
    await settle();
    const record = await workflow.control.apply(
      await workflow.control.propose(
        {
          kind: 'section.reorder-children',
          node: 'dashboard',
          children: ['activity', 'navigation', 'workspace'],
        },
        viewer,
      ),
    );
    const undo = await workflow.control.revert(record.id);
    await workflow.control.revert(undo.id);

    expect(workflow.document.nodes.find((n) => n.id === 'dashboard')?.children).toEqual([
      'activity',
      'navigation',
      'workspace',
    ]);
  });
});

describe('hydration restores persisted changes through policy (OQ1)', () => {
  it('replays what a viewer did last time', async () => {
    const first = start();
    await settle();
    await first.workflow.control.apply(
      await first.workflow.control.propose(
        {
          kind: 'section.reorder-children',
          node: 'dashboard',
          children: ['activity', 'navigation', 'workspace'],
        },
        viewer,
      ),
    );
    // What the application would have stored: the records themselves.
    const persisted = JSON.parse(JSON.stringify(first.workflow.control.log()));

    const next = start();
    await settle();
    const result = await next.workflow.control.hydrate(persisted);

    expect(result.applied).toBe(1);
    expect(next.workflow.getSnapshot().root.children.map((child) => child.id)).toEqual([
      'activity',
      'navigation',
      'workspace',
    ]);
  });

  it('drops a change the initiator is no longer entitled to, rather than restoring it', async () => {
    const first = start();
    await settle();
    await first.workflow.control.apply(
      await first.workflow.control.propose(
        {
          kind: 'section.reorder-children',
          node: 'dashboard',
          children: ['activity', 'navigation', 'workspace'],
        },
        viewer,
      ),
    );
    const persisted = JSON.parse(JSON.stringify(first.workflow.control.log()));

    // The viewer's permissions changed between sessions.
    const locked = createWorkflow<DashboardContext>(document, bundle(), {
      mode: 'development',
      initialContext: { viewer: {}, showsActivity: true },
      policy: (proposal) =>
        proposal.initiator.kind === 'user'
          ? { effect: 'deny', reason: 'Personalization is off for this account.' }
          : { effect: 'allow' },
    });
    await settle();

    const result = await locked.control.hydrate(persisted);
    expect(result.applied).toBe(0);
    expect(result.dropped[0]?.reason).toContain('Personalization is off');
    expect(locked.getSnapshot().root.children.map((child) => child.id)).toEqual([
      'navigation',
      'workspace',
      'activity',
    ]);
  });

  it('skips records that were already reverted', async () => {
    const first = start();
    await settle();
    const record = await first.workflow.control.apply(
      await first.workflow.control.propose(
        {
          kind: 'section.reorder-children',
          node: 'dashboard',
          children: ['activity', 'navigation', 'workspace'],
        },
        viewer,
      ),
    );
    await first.workflow.control.revert(record.id);
    const persisted = JSON.parse(JSON.stringify(first.workflow.control.log()));

    const next = start();
    await settle();
    const result = await next.workflow.control.hydrate(persisted);
    expect(result.applied).toBe(0);
  });
});

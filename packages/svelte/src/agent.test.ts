import { describe, expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { createAgentSurface } from '@leyline/agent';
import { createWorkflow, type CapabilityBundle } from '@leyline/core';
import WorkflowView from './lib/WorkflowView.svelte';
import { FALLBACK_RENDERERS } from './lib/fallback.js';
import DataTable from './test-renderers/DataTable.svelte';
import CardGrid from './test-renderers/CardGrid.svelte';
import MetricPanel from './test-renderers/MetricPanel.svelte';
import Link from './test-renderers/Link.svelte';
import Panel from './test-renderers/Panel.svelte';
import { referenceDocument, scenarioBundle, settle } from '@leyline/core/testing';

/**
 * Brief §2 items 6 and 7, against Svelte, through `@leyline/agent` (roadmap
 * stage 6).
 *
 * The exit criterion for this stage is not that these pass — it is that they
 * pass with **no changes to the agent package**. If operating a Svelte
 * application had needed anything React did not, the control plane would have
 * been carrying framework knowledge, which is the design defect stage 4 was
 * sequenced early to catch and this stage exists to confirm did not happen.
 */

interface ScenarioContext extends Record<string, unknown> {
  tier: string;
  actionTwoReady: boolean;
}

const catalogue = [
  ...FALLBACK_RENDERERS,
  {
    id: 'DataTable',
    description: 'Actions as a table.',
    claims: ['datatable'],
    component: DataTable,
  },
  {
    id: 'CardGrid',
    description: 'The same actions as cards.',
    claims: ['datatable'],
    component: CardGrid,
  },
  { id: 'MetricPanel', claims: ['metric-panel'], component: MetricPanel },
  { id: 'Link', claims: ['link'], component: Link },
  { id: 'Panel', claims: ['*'], component: Panel },
];

async function openApplication() {
  const workflow = createWorkflow<ScenarioContext>(
    referenceDocument('workspace-onboarding'),
    scenarioBundle() as CapabilityBundle,
    {
      mode: 'development',
      renderers: catalogue,
      initialContext: { tier: 'free', actionTwoReady: true },
    },
  );

  for (const [renderer, match, rank] of [
    ['DataTable', { surfaceType: 'datatable' }, 10],
    ['MetricPanel', { surfaceType: 'metric-panel' }, 10],
    ['Link', { surfaceType: 'link' }, 10],
    ['Panel', { target: 'region', nodeKind: 'hub' }, 10],
    ['Panel', { target: 'region', nodeKind: 'step' }, 10],
  ] as const) {
    await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'renderer.register', registry: 'default', renderer, match, rank },
        { kind: 'application' },
      ),
    );
  }
  await settle();

  const container = document.createElement('div');
  document.body.append(container);
  const component = mount(WorkflowView, { target: container, props: { workflow } });
  flushSync();

  // What an agent connecting to this application would be handed.
  const agent = createAgentSurface(workflow, {
    initiator: { kind: 'agent', label: 'svelte-driver' },
  });

  return {
    workflow,
    agent,
    container,
    find: (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`),
    destroy: () => {
      unmount(component);
      container.remove();
    },
  };
}

async function value(result: Promise<{ ok: boolean; value?: unknown }>): Promise<any> {
  const settled = await result;
  expect(settled.ok, JSON.stringify(settled)).toBe(true);
  return (settled as { value: unknown }).value;
}

describe('§2 item 6, in Svelte, through the unchanged agent package', () => {
  it('discovers the actions table without source access', async () => {
    const app = await openApplication();
    const described = await value(app.agent.handle('leyline_describe'));

    const actions = described.surfaces.find((s: { id: string }) => s.id === 'actions');
    expect(actions).toMatchObject({ type: 'datatable', renderer: 'DataTable', active: true });
    expect(described.registries[0].catalogue.map((entry: { id: string }) => entry.id)).toContain(
      'CardGrid',
    );
    app.destroy();
  });

  it('swaps the table for a card grid, and the Svelte tree changes', async () => {
    const app = await openApplication();
    expect(app.find('actions')?.tagName).toBe('TABLE');

    const proposal = await value(
      app.agent.handle('leyline_propose', {
        change: {
          kind: 'renderer.register',
          registry: 'default',
          renderer: 'CardGrid',
          match: { surfaceId: 'actions' },
          rank: 80,
        },
      }),
    );
    expect((await value(app.agent.handle('leyline_validate', { id: proposal.id }))).ok).toBe(true);
    await value(app.agent.handle('leyline_apply', { id: proposal.id }));

    await settle();
    flushSync();
    expect(app.find('actions')?.tagName).toBe('UL');
    expect(app.find('actions')?.dataset['variant']).toBe('cards');
    app.destroy();
  });

  it('reverts it, and the table comes back', async () => {
    const app = await openApplication();
    const proposal = await value(
      app.agent.handle('leyline_propose', {
        change: {
          kind: 'renderer.register',
          registry: 'default',
          renderer: 'CardGrid',
          match: { surfaceId: 'actions' },
          rank: 80,
        },
      }),
    );
    const record = await value(app.agent.handle('leyline_apply', { id: proposal.id }));
    await settle();
    flushSync();
    expect(app.find('actions')?.tagName).toBe('UL');

    await value(app.agent.handle('leyline_revert', { id: record.id }));
    await settle();
    flushSync();
    expect(app.find('actions')?.tagName).toBe('TABLE');
    app.destroy();
  });
});

describe('§2 item 7, in Svelte, through the unchanged agent package', () => {
  it('hides the metrics panel by attaching a guard', async () => {
    const app = await openApplication();
    expect(app.find('metrics')).not.toBeNull();

    const proposal = await value(
      app.agent.handle('leyline_propose', {
        change: {
          kind: 'surface.attach-guard',
          node: 'workspace-hub',
          surface: 'metrics',
          guard: 'needsBilling',
        },
      }),
    );
    await value(app.agent.handle('leyline_apply', { id: proposal.id }));

    await settle();
    flushSync();
    expect(app.find('metrics')).toBeNull();
    expect(app.find('actions')).not.toBeNull();
    app.destroy();
  });

  it('is refused against an undeclared guard, with something to act on', async () => {
    const app = await openApplication();
    const proposal = await value(
      app.agent.handle('leyline_propose', {
        change: {
          kind: 'surface.attach-guard',
          node: 'workspace-hub',
          surface: 'metrics',
          guard: 'isSecretlyAdmin',
        },
      }),
    );
    const validation = await value(app.agent.handle('leyline_validate', { id: proposal.id }));
    expect(validation.ok).toBe(false);
    expect(validation.issues[0].rule).toBe('capability.undeclared');
    app.destroy();
  });

  it('confirms its own effect on the trace stream', async () => {
    const app = await openApplication();
    const proposal = await value(
      app.agent.handle('leyline_propose', {
        change: {
          kind: 'surface.attach-guard',
          node: 'workspace-hub',
          surface: 'metrics',
          guard: 'needsBilling',
        },
      }),
    );
    await value(app.agent.handle('leyline_apply', { id: proposal.id }));

    const events = await value(app.agent.handle('leyline_trace', { limit: 40 }));
    const applied = events.filter((e: { kind: string }) => e.kind === 'control.applied').at(-1);
    expect(applied.initiator).toMatchObject({ kind: 'agent', label: 'svelte-driver' });
    app.destroy();
  });
});

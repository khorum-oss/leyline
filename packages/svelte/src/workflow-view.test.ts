import { describe, expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { createWorkflow, type CapabilityBundle, type WorkflowInstance } from '@leyline/core';
import WorkflowView from './lib/WorkflowView.svelte';
import { FALLBACK_RENDERERS } from './lib/fallback.js';
import DataTable from './test-renderers/DataTable.svelte';
import CardGrid from './test-renderers/CardGrid.svelte';
import MetricPanel from './test-renderers/MetricPanel.svelte';
import Link from './test-renderers/Link.svelte';
import Panel from './test-renderers/Panel.svelte';
import { referenceDocument, scenarioBundle, settle } from './testing/scenario.js';

/**
 * The §2 scenario in a real Svelte tree (roadmap stage 6).
 *
 * The genuine test of whether the core stayed headless: the same document, the
 * same capabilities, the same control plane, and a second framework rendering
 * it with no changes to anything below the adapter.
 */

interface ScenarioContext extends Record<string, unknown> {
  tier: string;
  actionTwoReady: boolean;
}

const catalogue = [
  ...FALLBACK_RENDERERS,
  { id: 'DataTable', claims: ['datatable'], component: DataTable },
  { id: 'CardGrid', description: 'Rows as cards.', claims: ['datatable'], component: CardGrid },
  { id: 'MetricPanel', claims: ['metric-panel'], component: MetricPanel },
  { id: 'Link', claims: ['link'], component: Link },
  { id: 'Panel', claims: ['*'], component: Panel },
];

interface Mounted {
  workflow: WorkflowInstance<ScenarioContext>;
  container: HTMLElement;
  destroy: () => void;
}

async function open(context: Partial<ScenarioContext> = {}, register = true): Promise<Mounted> {
  const workflow = createWorkflow<ScenarioContext>(
    referenceDocument('workspace-onboarding'),
    scenarioBundle() as CapabilityBundle,
    {
      mode: 'development',
      renderers: catalogue,
      initialContext: { tier: 'free', actionTwoReady: true, ...context } as ScenarioContext,
    },
  );

  if (register) {
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
  }

  await settle();
  const container = document.createElement('div');
  document.body.append(container);
  const component = mount(WorkflowView, { target: container, props: { workflow } });
  flushSync();

  return {
    workflow,
    container,
    destroy: () => {
      unmount(component);
      container.remove();
    },
  };
}

const find = (view: Mounted, id: string) =>
  view.container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('the §2 scenario in Svelte (items 1–5)', () => {
  it('renders the hub with its surfaces and their data', async () => {
    const view = await open();
    expect(find(view, 'region-workspace-hub')).not.toBeNull();
    expect(find(view, 'actions')?.textContent).toContain('invite');
    expect(find(view, 'metrics')?.textContent).toContain('3');
    view.destroy();
  });

  it('shows the action-two link only when workspace state permits it', async () => {
    const permitted = await open({ actionTwoReady: true });
    expect(find(permitted, 'to-action-two')).not.toBeNull();
    permitted.destroy();

    const withheld = await open({ actionTwoReady: false });
    expect(find(withheld, 'to-action-two')).toBeNull();
    expect(find(withheld, 'to-action-three')).not.toBeNull();
    withheld.destroy();
  });

  it('clicking a link runs the action and returns to the hub', async () => {
    const view = await open({ actionTwoReady: true });
    find(view, 'to-action-two')?.click();
    await settle();
    flushSync();
    expect(find(view, 'region-workspace-hub')).not.toBeNull();
    expect(find(view, 'actions')).not.toBeNull();
    view.destroy();
  });
});

describe('the control plane reaches Svelte unchanged', () => {
  it('swapping the renderer changes what is drawn', async () => {
    const view = await open();
    expect(find(view, 'actions')?.tagName).toBe('TABLE');

    await view.workflow.control.apply(
      await view.workflow.control.propose(
        {
          kind: 'renderer.register',
          registry: 'default',
          renderer: 'CardGrid',
          match: { surfaceId: 'actions' },
          rank: 80,
        },
        { kind: 'agent', label: 'card-grid-swap' },
      ),
    );
    await settle();
    flushSync();

    expect(find(view, 'actions')?.tagName).toBe('UL');
    expect(find(view, 'actions')?.dataset['variant']).toBe('cards');
    view.destroy();
  });

  it('attaching a guard removes the surface', async () => {
    const view = await open();
    expect(find(view, 'metrics')).not.toBeNull();

    await view.workflow.control.apply(
      await view.workflow.control.propose(
        {
          kind: 'surface.attach-guard',
          node: 'workspace-hub',
          surface: 'metrics',
          guard: 'needsBilling',
        },
        { kind: 'agent' },
      ),
    );
    await settle();
    flushSync();

    expect(find(view, 'metrics')).toBeNull();
    expect(find(view, 'actions')).not.toBeNull();
    view.destroy();
  });
});

describe('nothing claiming a surface draws a placeholder (AD5)', () => {
  it('renders the fallback and keeps the rest of the page', async () => {
    const view = await open({}, false);
    expect(view.container.querySelector('[data-leyline-surface="actions"]')?.textContent).toBe(
      'datatable',
    );
    expect(view.container.querySelector('[data-leyline-region="workspace-hub"]')).not.toBeNull();
    view.destroy();
  });
});

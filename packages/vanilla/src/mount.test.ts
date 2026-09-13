import { describe, expect, it } from 'vitest';
import { createWorkflow, type CapabilityBundle, type WorkflowInstance } from '@leyline/core';
import { mount } from './mount.js';
import { FALLBACK_RENDERERS } from './fallback.js';
import type { RegionRenderer, SurfaceRenderer } from './types.js';
import { referenceDocument, scenarioBundle, settle } from './testing/scenario.js';

/**
 * The §2 scenario with no framework at all.
 *
 * If this works, the core really is headless: the same document, the same
 * capabilities, the same control plane, and nothing between them and the DOM
 * but this package.
 */

interface ScenarioContext extends Record<string, unknown> {
  tier: string;
  actionTwoReady: boolean;
}

const table: SurfaceRenderer = ({ surface }) => {
  const element = document.createElement('table');
  element.dataset['testid'] = surface.id;
  for (const row of (surface.data ?? []) as { id: string }[]) {
    const tr = document.createElement('tr');
    tr.textContent = row.id;
    element.append(tr);
  }
  return element;
};

const cards: SurfaceRenderer = ({ surface }) => {
  const element = document.createElement('ul');
  element.dataset['testid'] = surface.id;
  element.dataset['variant'] = 'cards';
  for (const row of (surface.data ?? []) as { id: string }[]) {
    const li = document.createElement('li');
    li.textContent = row.id;
    element.append(li);
  }
  return element;
};

const metrics: SurfaceRenderer = ({ surface }) => {
  const element = document.createElement('dl');
  element.dataset['testid'] = surface.id;
  element.textContent = String((surface.data as { members?: number })?.members ?? '');
  return element;
};

const link: SurfaceRenderer = ({ surface }) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset['testid'] = surface.id;
  button.textContent = String(surface.props['label'] ?? surface.id);
  const props = surface.getters['link']?.() as { onActivate: () => void } | undefined;
  button.addEventListener('click', () => props?.onActivate());
  return button;
};

const panel: RegionRenderer = ({ region, surfaces, regions }) => {
  const element = document.createElement('section');
  element.dataset['testid'] = `region-${region.id}`;
  for (const slot of surfaces) element.append(slot.render());
  for (const slot of regions) element.append(slot.render());
  return element;
};

const catalogue = [
  ...FALLBACK_RENDERERS,
  { id: 'DataTable', claims: ['datatable'], component: table },
  { id: 'CardGrid', claims: ['datatable'], component: cards },
  { id: 'MetricPanel', claims: ['metric-panel'], component: metrics },
  { id: 'Link', claims: ['link'], component: link },
  { id: 'Panel', claims: ['*'], component: panel },
];

interface Mounted {
  workflow: WorkflowInstance<ScenarioContext>;
  container: HTMLElement;
  unmount: () => void;
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

  const container = document.createElement('div');
  document.body.append(container);
  const unmount = mount(workflow, { container });
  await settle();
  return {
    workflow,
    container,
    unmount: () => {
      unmount();
      container.remove();
    },
  };
}

const find = (view: Mounted, id: string) =>
  view.container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('the §2 scenario, with no framework (items 1–5)', () => {
  it('renders the hub with its surfaces and data', async () => {
    const view = await open();
    expect(find(view, 'region-workspace-hub')).not.toBeNull();
    expect(find(view, 'actions')?.textContent).toContain('invite');
    expect(find(view, 'metrics')?.textContent).toContain('3');
    view.unmount();
  });

  it('shows the action-two link only when workspace state permits it', async () => {
    const permitted = await open({ actionTwoReady: true });
    expect(find(permitted, 'to-action-two')).not.toBeNull();
    permitted.unmount();

    const withheld = await open({ actionTwoReady: false });
    expect(find(withheld, 'to-action-two')).toBeNull();
    expect(find(withheld, 'to-action-three')).not.toBeNull();
    withheld.unmount();
  });

  it('clicking a link runs the action and returns to the hub', async () => {
    const view = await open({ actionTwoReady: true });
    find(view, 'to-action-two')?.click();
    await settle();
    expect(find(view, 'region-workspace-hub')).not.toBeNull();
    expect(find(view, 'actions')).not.toBeNull();
    view.unmount();
  });

  it('redraws when context changes', async () => {
    const view = await open({ actionTwoReady: true });
    await view.workflow.control.apply(
      await view.workflow.control.propose(
        { kind: 'context.patch', values: { actionTwoReady: false } },
        { kind: 'application' },
      ),
    );
    await settle();
    expect(find(view, 'to-action-two')).toBeNull();
    view.unmount();
  });

  it('stops redrawing and clears the container on unmount', async () => {
    const view = await open();
    expect(view.container.childElementCount).toBeGreaterThan(0);
    view.unmount();
    expect(view.container.childElementCount).toBe(0);
  });
});

describe('the control plane reaches the DOM the same way it reaches React', () => {
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

    expect(find(view, 'actions')?.tagName).toBe('UL');
    expect(find(view, 'actions')?.dataset['variant']).toBe('cards');
    view.unmount();
  });
});

describe('nothing claiming a surface draws a placeholder (AD5)', () => {
  it('renders the fallback and keeps the rest of the page', async () => {
    const view = await open({}, false);
    expect(view.container.querySelector('[data-leyline-surface="actions"]')?.textContent).toBe(
      'datatable',
    );
    expect(view.container.querySelector('[data-leyline-region="workspace-hub"]')).not.toBeNull();
    view.unmount();
  });
});

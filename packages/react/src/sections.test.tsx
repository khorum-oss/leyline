import { describe, expect, it } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createWorkflow, type CapabilityBundle } from '@leyline/core';
import { WorkflowView } from './WorkflowView.jsx';
import { FALLBACK_RENDERERS } from './fallback.jsx';
import type { RegionRenderer, SurfaceRenderer } from './types.js';
import { referenceDocument, settle } from './testing/scenario.js';

(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true;

/**
 * Named slots (decision 0030): a section renderer decides where its children
 * go. The two renderers below arrange the same three regions differently from
 * the same document, which is the whole claim.
 */

interface DashboardContext extends Record<string, unknown> {
  readonly showsActivity: boolean;
}

const Text: SurfaceRenderer = ({ surface }) => (
  <p data-testid={surface.id}>{String(surface.props['value'] ?? '')}</p>
);

const Anything: SurfaceRenderer = ({ surface }) => <div data-testid={surface.id} />;

/** Renders its children in reading order, one after another. */
const Stacked: RegionRenderer = ({ region, surfaces, regions }) => (
  <div data-testid={`stack-${region.id}`}>
    {surfaces.map((slot) => (
      <div key={slot.id}>{slot.render()}</div>
    ))}
    {regions.map((slot) => (
      <div key={slot.id} data-slot={slot.id}>
        {slot.render()}
      </div>
    ))}
  </div>
);

/** Puts one named child in an aside and the rest in a main, from the same slots. */
const TwoColumn: RegionRenderer = ({ region, surfaces, regions }) => {
  const aside = regions.find((slot) => slot.id === 'navigation');
  const rest = regions.filter((slot) => slot.id !== 'navigation');
  return (
    <div data-testid={`columns-${region.id}`}>
      <aside data-testid="column-aside">{aside ? aside.render() : null}</aside>
      <main data-testid="column-main">
        {surfaces.map((slot) => (
          <div key={slot.id}>{slot.render()}</div>
        ))}
        {rest.map((slot) => (
          <div key={slot.id}>{slot.render()}</div>
        ))}
      </main>
    </div>
  );
};

const catalogue = [
  ...FALLBACK_RENDERERS,
  { id: 'Text', claims: ['text'], component: Text },
  { id: 'Anything', claims: ['*'], component: Anything },
  { id: 'Stacked', claims: ['*'], component: Stacked },
  {
    id: 'TwoColumn',
    description: 'Navigation aside, everything else in main.',
    claims: ['*'],
    component: TwoColumn,
  },
];

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

async function mount(regionRenderer: string) {
  const workflow = createWorkflow<DashboardContext>(
    referenceDocument('personal-dashboard'),
    bundle(),
    { mode: 'development', renderers: catalogue, initialContext: { showsActivity: true } },
  );

  for (const [renderer, match, rank] of [
    ['Text', { surfaceType: 'text' }, 10],
    ['Anything', { surfaceType: 'datatable' }, 10],
    ['Anything', { surfaceType: 'metric-panel' }, 10],
    ['Anything', { surfaceType: 'link' }, 10],
    ['Anything', { surfaceType: 'form' }, 10],
    ['Stacked', { target: 'region', nodeKind: 'hub' }, 10],
    ['Stacked', { target: 'region', nodeKind: 'step' }, 10],
    [regionRenderer, { target: 'region', nodeId: 'dashboard' }, 20],
    ['Stacked', { target: 'region', nodeKind: 'section' }, 10],
  ] as const) {
    await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'renderer.register', registry: 'default', renderer, match, rank },
        { kind: 'application' },
      ),
    );
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render((<WorkflowView workflow={workflow} />) as ReactElement);
    await settle();
  });
  return {
    workflow,
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('a section renderer arranges its children', () => {
  it('renders every region of a page that runs them all at once', async () => {
    const view = await mount('Stacked');
    expect(view.container.querySelector('[data-testid="stack-dashboard"]')).not.toBeNull();
    for (const id of ['navigation', 'workspace', 'activity']) {
      expect(view.container.querySelector(`[data-slot="${id}"]`), id).not.toBeNull();
    }
    view.unmount();
  });

  it('presents its own surfaces alongside its children', async () => {
    const view = await mount('Stacked');
    expect(view.container.querySelector('[data-testid="page-heading"]')?.textContent).toBe(
      'Your dashboard',
    );
    view.unmount();
  });

  it('a different renderer arranges the same regions differently', async () => {
    const view = await mount('TwoColumn');
    const aside = view.container.querySelector('[data-testid="column-aside"]');
    const main = view.container.querySelector('[data-testid="column-main"]');

    // The document did not change; the component decided where each named slot went.
    expect(aside?.querySelector('[data-testid="stack-navigation"]')).not.toBeNull();
    expect(main?.querySelector('[data-testid="stack-navigation"]')).toBeNull();
    expect(main?.querySelector('[data-testid="page-heading"]')).not.toBeNull();
    view.unmount();
  });

  it('a renderer that ignores a slot simply does not draw it', async () => {
    // TwoColumn draws `navigation` in the aside; nothing renders a slot twice.
    const view = await mount('TwoColumn');
    expect(view.container.querySelectorAll('[data-testid="stack-navigation"]')).toHaveLength(1);
    view.unmount();
  });

  it('a guarded surface stays out of the tree entirely', async () => {
    const view = await mount('Stacked');
    expect(view.container.querySelector('[data-testid="activity-feed"]')).not.toBeNull();

    await act(async () => {
      await view.workflow.control.apply(
        await view.workflow.control.propose(
          { kind: 'context.patch', values: { showsActivity: false } },
          { kind: 'application' },
        ),
      );
      await settle();
    });

    expect(view.container.querySelector('[data-testid="activity-feed"]')).toBeNull();
    // The region is still there; only the surface went.
    expect(view.container.querySelector('[data-slot="activity"]')).not.toBeNull();
    view.unmount();
  });
});

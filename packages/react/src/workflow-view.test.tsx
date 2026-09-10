import { describe, expect, it } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createWorkflow, type CapabilityBundle, type WorkflowInstance } from '@leyline/core';
import { WorkflowView } from './WorkflowView.jsx';
import { FALLBACK_RENDERERS } from './fallback.jsx';
import type { RegionRenderer, SurfaceRenderer } from './types.js';
import { referenceDocument, scenarioBundle, settle } from './testing/scenario.js';

(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true;

/**
 * The §2 scenario, items 1–5, in a real React tree (roadmap stage 3).
 *
 * Everything asserted here is asserted against the DOM, because "the link
 * disappears when workspace state changes" is a claim about what a user sees,
 * not about what a snapshot contains.
 */

interface ScenarioContext extends Record<string, unknown> {
  readonly tier: string;
  readonly actionTwoReady: boolean;
}

const DataTable: SurfaceRenderer = ({ surface }) => (
  <table data-testid={surface.id}>
    <tbody>
      {((surface.data ?? []) as { id: string }[]).map((row) => (
        <tr key={row.id}>
          <td>{row.id}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const CardGrid: SurfaceRenderer = ({ surface }) => (
  <ul data-testid={surface.id} data-variant="cards">
    {((surface.data ?? []) as { id: string }[]).map((row) => (
      <li key={row.id}>{row.id}</li>
    ))}
  </ul>
);

const MetricPanel: SurfaceRenderer = ({ surface }) => (
  <dl data-testid={surface.id}>
    <dd>{String((surface.data as { members?: number })?.members ?? '')}</dd>
  </dl>
);

const Link: SurfaceRenderer = ({ surface }) => {
  const props = surface.getters['link']?.() as { onActivate: () => void } | undefined;
  return (
    <button type="button" data-testid={surface.id} onClick={() => props?.onActivate()}>
      {String(surface.props['label'] ?? surface.id)}
    </button>
  );
};

const Panel: RegionRenderer = ({ region, surfaces, regions }) => (
  <section data-testid={`region-${region.id}`}>
    {surfaces.map((slot) => (
      <div key={slot.id}>{slot.render()}</div>
    ))}
    {regions.map((slot) => (
      <div key={slot.id}>{slot.render()}</div>
    ))}
  </section>
);

const catalogue = [
  ...FALLBACK_RENDERERS,
  { id: 'DataTable', claims: ['datatable'], component: DataTable },
  {
    id: 'CardGrid',
    description: 'Rows as a grid of cards.',
    claims: ['datatable'],
    component: CardGrid,
  },
  { id: 'MetricPanel', claims: ['metric-panel'], component: MetricPanel },
  { id: 'Link', claims: ['link'], component: Link },
  { id: 'Panel', claims: ['*'], component: Panel },
];

interface Mounted {
  workflow: WorkflowInstance<ScenarioContext>;
  container: HTMLElement;
  root: Root;
  unmount: () => void;
}

async function mount(context: Partial<ScenarioContext>): Promise<Mounted> {
  const workflow = createWorkflow<ScenarioContext>(
    referenceDocument('workspace-onboarding'),
    scenarioBundle() as CapabilityBundle,
    {
      mode: 'development',
      renderers: catalogue,
      initialContext: { tier: 'free', actionTwoReady: false, ...context } as ScenarioContext,
    },
  );

  for (const [renderer, match, rank] of [
    ['DataTable', { surfaceType: 'datatable' }, 10],
    ['MetricPanel', { surfaceType: 'metric-panel' }, 10],
    ['Link', { surfaceType: 'link' }, 10],
    // Every active node is a region, not only sections; a hub is drawn by
    // whichever renderer claims it, exactly like a surface (decision 0030).
    ['Panel', { target: 'region', nodeKind: 'hub' }, 10],
    ['Panel', { target: 'region', nodeKind: 'section' }, 10],
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
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const testId = (view: Mounted, id: string): HTMLElement | null =>
  view.container.querySelector(`[data-testid="${id}"]`);

describe('the §2 scenario in a React tree (items 1–5)', () => {
  it('renders the hub the workflow arrived at', async () => {
    const view = await mount({ tier: 'free' });
    expect(testId(view, 'region-workspace-hub')).not.toBeNull();
    view.unmount();
  });

  it('draws the actions table with the data its source returned', async () => {
    const view = await mount({ tier: 'free' });
    const table = testId(view, 'actions');
    expect(table?.tagName).toBe('TABLE');
    expect(table?.textContent).toContain('invite');
    expect(table?.textContent).toContain('archive');
    view.unmount();
  });

  it('draws the metrics panel', async () => {
    const view = await mount({ tier: 'free' });
    expect(testId(view, 'metrics')?.textContent).toContain('3');
    view.unmount();
  });

  it('shows the action-two link only when workspace state permits it', async () => {
    const permitted = await mount({ actionTwoReady: true });
    expect(testId(permitted, 'to-action-two')).not.toBeNull();
    permitted.unmount();

    const withheld = await mount({ actionTwoReady: false });
    expect(testId(withheld, 'to-action-two')).toBeNull();
    // The other link is unaffected, so this is presence rather than a blank page.
    expect(testId(withheld, 'to-action-three')).not.toBeNull();
    withheld.unmount();
  });

  it('the link disappears when context changes, with no page reconstruction', async () => {
    const view = await mount({ actionTwoReady: true });
    const hubBefore = testId(view, 'region-workspace-hub');
    expect(testId(view, 'to-action-two')).not.toBeNull();

    await act(async () => {
      await view.workflow.control.apply(
        await view.workflow.control.propose(
          { kind: 'context.patch', values: { actionTwoReady: false } },
          { kind: 'application' },
        ),
      );
      await settle();
    });

    expect(testId(view, 'to-action-two')).toBeNull();
    expect(testId(view, 'region-workspace-hub')).not.toBeNull();
    expect(hubBefore?.isConnected).toBe(true);
    view.unmount();
  });

  it('clicking a link runs the action and returns to the hub', async () => {
    const view = await mount({ actionTwoReady: true });
    await act(async () => {
      (testId(view, 'to-action-two') as HTMLButtonElement).click();
      await settle();
    });
    expect(testId(view, 'region-workspace-hub')).not.toBeNull();
    expect(testId(view, 'actions')).not.toBeNull();
    view.unmount();
  });
});

describe('the registry decides appearance, and the control plane decides the registry', () => {
  it('swapping the renderer changes what is drawn, without touching the document', async () => {
    const view = await mount({ tier: 'free' });
    expect(testId(view, 'actions')?.tagName).toBe('TABLE');
    const documentBefore = view.workflow.document;

    await act(async () => {
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
    });

    const swapped = testId(view, 'actions');
    expect(swapped?.tagName).toBe('UL');
    expect(swapped?.getAttribute('data-variant')).toBe('cards');
    expect(swapped?.textContent).toContain('invite');
    // The workflow definition never changed; only the registry did.
    expect(view.workflow.document).toBe(documentBefore);
    view.unmount();
  });

  it('reverting brings the table back', async () => {
    const view = await mount({ tier: 'free' });
    let record: { id: string } | undefined;
    await act(async () => {
      record = await view.workflow.control.apply(
        await view.workflow.control.propose(
          {
            kind: 'renderer.register',
            registry: 'default',
            renderer: 'CardGrid',
            match: { surfaceId: 'actions' },
            rank: 80,
          },
          { kind: 'agent' },
        ),
      );
      await settle();
    });
    expect(testId(view, 'actions')?.tagName).toBe('UL');

    await act(async () => {
      await view.workflow.control.revert((record as { id: string }).id);
      await settle();
    });
    expect(testId(view, 'actions')?.tagName).toBe('TABLE');
    view.unmount();
  });
});

describe('nothing claiming a surface draws a placeholder rather than failing (AD5)', () => {
  it('renders the fallback and keeps the rest of the page', async () => {
    const workflow = createWorkflow<ScenarioContext>(
      referenceDocument('workspace-onboarding'),
      scenarioBundle() as CapabilityBundle,
      {
        mode: 'development',
        renderers: catalogue,
        initialContext: { tier: 'free', actionTwoReady: true },
      },
    );
    // No registrations at all: every surface is unclaimed.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render((<WorkflowView workflow={workflow} />) as ReactElement);
      await settle();
    });

    const placeholder = container.querySelector('[data-leyline-surface="actions"]');
    expect(placeholder?.textContent).toBe('datatable');
    expect(container.querySelector('[data-leyline-region="workspace-hub"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('reports it on the trace stream, because a placeholder needs explaining', async () => {
    const kinds: string[] = [];
    const workflow = createWorkflow<ScenarioContext>(
      referenceDocument('workspace-onboarding'),
      scenarioBundle() as CapabilityBundle,
      {
        mode: 'development',
        renderers: catalogue,
        sinks: [(event) => kinds.push(event.kind)],
        initialContext: { tier: 'free', actionTwoReady: true },
      },
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render((<WorkflowView workflow={workflow} />) as ReactElement);
      await settle();
    });

    expect(kinds).toContain('surface.unresolved');
    act(() => root.unmount());
    container.remove();
  });
});

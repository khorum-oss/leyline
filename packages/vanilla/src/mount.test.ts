import { describe, expect, it } from 'vitest';
import type { WorkflowInstance } from '@khorum-oss/leyline-core';
import {
  applyChange,
  openScenario,
  settle,
  swapActionsToCardGrid,
  type ScenarioContext,
} from '@khorum-oss/leyline-core/testing';
import { mount } from './mount.js';
import { FALLBACK_RENDERERS } from './fallback.js';
import type { RegionRenderer, SurfaceRenderer } from './types.js';

/**
 * The §2 scenario with no framework at all.
 *
 * If this works, the core really is headless: the same document, the same
 * capabilities, the same control plane, and nothing between them and the DOM
 * but this package.
 *
 * Standing the scenario up comes from `@khorum-oss/leyline-core/testing`, the same as it
 * does for React and Svelte. The renderers below are the whole difference:
 * without a framework, a renderer returns a `Node`.
 */

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

const components = {
  DataTable: table,
  CardGrid: cards,
  MetricPanel: metrics,
  Link: link,
  Panel: panel,
};

interface Mounted {
  workflow: WorkflowInstance<ScenarioContext>;
  container: HTMLElement;
  unmount: () => void;
}

async function open(context: Partial<ScenarioContext> = {}, register = true): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.append(container);

  const workflow = await openScenario({
    components,
    fallbacks: FALLBACK_RENDERERS,
    context,
    register,
  });
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
    await applyChange(view.workflow, {
      kind: 'context.patch',
      values: { actionTwoReady: false },
    });
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

    await swapActionsToCardGrid(view.workflow);
    await settle();

    expect(find(view, 'actions')?.tagName).toBe('UL');
    expect(find(view, 'actions')?.dataset['variant']).toBe('cards');
    view.unmount();
  });
});

describe('nothing claiming a surface draws a placeholder (AD5)', () => {
  it('renders the fallback and keeps the rest of the page', async () => {
    const view = await open({}, false);
    const placeholder = view.container.querySelector('[data-leyline-surface="actions"]');

    // The surface type is what the placeholder shows, because "this build has
    // no renderer for a datatable" is the one useful thing it knows.
    expect(placeholder?.textContent).toBe('datatable');
    expect(placeholder?.tagName).toBe('DIV');
    expect(view.container.querySelector('[data-leyline-region="workspace-hub"]')).not.toBeNull();
    view.unmount();
  });
});

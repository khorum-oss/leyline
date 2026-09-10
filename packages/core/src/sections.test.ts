import { describe, expect, it } from 'vitest';
import { createWorkflow } from './workflow.js';
import { activeSurfaces, walkRegions, type ActiveRegion } from './contracts.js';
import { referenceDocument, settle } from './testing/scenario.js';
import type { CapabilityBundle } from './contracts.js';

const document = referenceDocument('personal-dashboard');

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
      navigationItems: () => [{ id: 'one' }],
      summaryMetrics: () => ({ total: 12 }),
      activityFeed: () => [{ id: 'event' }],
      itemDetail: () => ({ title: 'Item 42' }),
    },
  } as CapabilityBundle;
}

function start(context: Partial<DashboardContext> = {}) {
  return createWorkflow<DashboardContext>(document, bundle(), {
    mode: 'development',
    initialContext: { viewer: {}, showsActivity: true, ...context } as DashboardContext,
  });
}

const idsOf = (region: ActiveRegion): string[] => [...walkRegions(region)].map((r) => r.id);
const childOf = (region: ActiveRegion, id: string): ActiveRegion | undefined =>
  [...walkRegions(region)].find((candidate) => candidate.id === id);

describe('a section running every child at once', () => {
  it('holds all three regions active together', async () => {
    const workflow = start();
    await settle();
    const root = workflow.getSnapshot().root;
    expect(root.id).toBe('dashboard');
    expect(root.kind).toBe('section');
    expect(root.children.map((child) => child.id)).toEqual(['navigation', 'workspace', 'activity']);
  });

  it('presents its own surfaces alongside those of its children', async () => {
    const workflow = start();
    await settle();
    expect(activeSurfaces(workflow.getSnapshot().root).map((surface) => surface.id)).toEqual([
      'page-heading',
      'nav-items',
      'to-workspace',
      'overview-metrics',
      'to-detail',
      'activity-feed',
    ]);
  });

  it('keeps a guarded surface out for a viewer who dropped it', async () => {
    const workflow = start({ showsActivity: false });
    await settle();
    const ids = activeSurfaces(workflow.getSnapshot().root).map((surface) => surface.id);
    expect(ids).not.toContain('activity-feed');
    // The region itself stays active; only the surface is absent.
    expect(idsOf(workflow.getSnapshot().root)).toContain('activity');
  });
});

describe('a section running one child at a time', () => {
  it('starts at its initial child', async () => {
    const workflow = start();
    await settle();
    const workspace = childOf(workflow.getSnapshot().root, 'workspace');
    expect(workspace?.children.map((child) => child.id)).toEqual(['workspace-overview']);
  });

  it('advances through its children while the other regions carry on', async () => {
    const workflow = start();
    await settle();

    const link = activeSurfaces(workflow.getSnapshot().root).find((s) => s.id === 'to-detail');
    (link?.getters['link']?.() as { onActivate: () => void }).onActivate();
    await settle();

    const root = workflow.getSnapshot().root;
    expect(childOf(root, 'workspace')?.children.map((c) => c.id)).toEqual(['workspace-detail']);
    // The point of parallel regions: neither sibling moved.
    expect(root.children.map((child) => child.id)).toEqual(['navigation', 'workspace', 'activity']);
    expect(idsOf(root)).toContain('activity');
  });

  it('assigns the service result into context along the way', async () => {
    const workflow = start();
    await settle();
    const link = activeSurfaces(workflow.getSnapshot().root).find((s) => s.id === 'to-detail');
    (link?.getters['link']?.() as { onActivate: () => void }).onActivate();
    await settle();
    expect(workflow.getSnapshot().context.selectedItem).toBe('item_42');
  });

  it('comes back to the overview, leaving the rest of the page untouched', async () => {
    const workflow = start();
    await settle();
    const forward = activeSurfaces(workflow.getSnapshot().root).find((s) => s.id === 'to-detail');
    (forward?.getters['link']?.() as { onActivate: () => void }).onActivate();
    await settle();

    const back = activeSurfaces(workflow.getSnapshot().root).find(
      (s) => s.id === 'back-to-overview',
    );
    (back?.getters['link']?.() as { onActivate: () => void }).onActivate();
    await settle();

    const root = workflow.getSnapshot().root;
    expect(childOf(root, 'workspace')?.children.map((c) => c.id)).toEqual(['workspace-overview']);
    expect(root.children).toHaveLength(3);
  });

  it('enters at its initial child when a sibling region links to the section itself', async () => {
    const workflow = start();
    await settle();
    const enter = activeSurfaces(workflow.getSnapshot().root).find((s) => s.id === 'to-workspace');
    (enter?.getters['link']?.() as { onActivate: () => void }).onActivate();
    await settle();
    expect(childOf(workflow.getSnapshot().root, 'workspace')?.children.map((c) => c.id)).toEqual([
      'workspace-overview',
    ]);
  });
});

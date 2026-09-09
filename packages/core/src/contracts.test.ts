import { describe, expect, it } from 'vitest';
import { activeSurfaces, walkRegions, type ActiveRegion } from './contracts.js';

const surface = (id: string) => ({ id, type: 'text', props: {}, getters: {} });

/** The §2 dashboard shape: a page running three regions, one of them nested. */
const page: ActiveRegion = {
  id: 'dashboard',
  kind: 'section',
  surfaces: [surface('page-heading')],
  children: [
    { id: 'navigation', kind: 'hub', surfaces: [surface('nav-items')], children: [] },
    {
      id: 'workspace',
      kind: 'section',
      surfaces: [],
      children: [
        {
          id: 'workspace-overview',
          kind: 'hub',
          surfaces: [surface('overview-metrics')],
          children: [],
        },
      ],
    },
    { id: 'activity', kind: 'hub', surfaces: [surface('activity-feed')], children: [] },
  ],
};

describe('the active tree', () => {
  it('walks depth-first in reading order, root included', () => {
    expect([...walkRegions(page)].map((region) => region.id)).toEqual([
      'dashboard',
      'navigation',
      'workspace',
      'workspace-overview',
      'activity',
    ]);
  });

  it('collects every surface an adapter has to render, in the same order', () => {
    expect(activeSurfaces(page).map((s) => s.id)).toEqual([
      'page-heading',
      'nav-items',
      'overview-metrics',
      'activity-feed',
    ]);
  });

  it('treats a leaf node as the same shape with no children', () => {
    const leaf: ActiveRegion = {
      id: 'billing',
      kind: 'step',
      surfaces: [surface('form')],
      children: [],
    };
    expect([...walkRegions(leaf)]).toHaveLength(1);
    expect(activeSurfaces(leaf).map((s) => s.id)).toEqual(['form']);
  });
});

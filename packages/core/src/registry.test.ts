import { describe, expect, it } from 'vitest';
import { RendererRegistry } from './registry.js';
import type { ResolvedSurface } from './contracts.js';

const surface = (id: string, type: string, nodeId = 'hub'): ResolvedSurface => ({
  id,
  nodeId,
  type,
  props: {},
  getters: {},
});

const catalogue = [
  { id: 'DataTable', claims: ['datatable'], component: 'table' },
  { id: 'CardGrid', claims: ['datatable'], component: 'cards' },
  { id: 'Anything', claims: ['*'], component: 'any' },
];

function registry(): RendererRegistry {
  return new RendererRegistry('default', catalogue);
}

describe('ranked resolution (AD5)', () => {
  it('lets a specific claim beat a generic one', () => {
    const r = registry();
    r.register('DataTable', { surfaceType: 'datatable' }, 10);
    r.register('CardGrid', { surfaceId: 'actions' }, 80);

    expect(r.resolve(surface('actions', 'datatable'))?.renderer).toBe('CardGrid');
    expect(r.resolve(surface('members', 'datatable'))?.renderer).toBe('DataTable');
  });

  it('breaks a tie toward the entry registered later', () => {
    const r = registry();
    r.register('DataTable', { surfaceType: 'datatable' }, 50);
    r.register('CardGrid', { surfaceType: 'datatable' }, 50);
    expect(r.resolve(surface('actions', 'datatable'))?.renderer).toBe('CardGrid');
  });

  it('matches on node as well as surface', () => {
    const r = registry();
    r.register('CardGrid', { nodeId: 'workspace-hub', surfaceType: 'datatable' }, 40);
    expect(r.resolve(surface('actions', 'datatable', 'workspace-hub'))?.renderer).toBe('CardGrid');
    expect(r.resolve(surface('actions', 'datatable', 'other'))).toBeUndefined();
  });

  it('returns undefined rather than throwing when nothing claims a surface', () => {
    const r = registry();
    r.register('DataTable', { surfaceType: 'datatable' }, 10);
    // The caller draws the registered fallback and logs. Resolution never throws.
    expect(() => r.resolve(surface('heading', 'text'))).not.toThrow();
    expect(r.resolve(surface('heading', 'text'))).toBeUndefined();
  });

  it('honours a wildcard claim', () => {
    const r = registry();
    r.register('Anything', { surfaceType: 'timeline' }, 5);
    expect(r.resolve(surface('feed', 'timeline'))?.renderer).toBe('Anything');
  });

  it('hands back the component untouched, whatever it is', () => {
    const r = registry();
    r.register('DataTable', { surfaceId: 'actions' }, 10);
    expect(r.resolve(surface('actions', 'datatable'))?.component).toBe('table');
  });
});

describe('the catalogue is the gate (I3)', () => {
  it('knows only what the application published', () => {
    const r = registry();
    expect(r.knows('CardGrid')).toBe(true);
    expect(r.knows('SomethingElse')).toBe(false);
  });

  it('reports what each renderer is willing to draw', () => {
    const r = registry();
    expect(r.claims('DataTable', 'datatable')).toBe(true);
    expect(r.claims('DataTable', 'metric-panel')).toBe(false);
    expect(r.claims('Anything', 'metric-panel')).toBe(true);
  });

  it('resolves nothing for an entry whose renderer left the catalogue', () => {
    const r = new RendererRegistry('default', catalogue);
    r.register('CardGrid', { surfaceId: 'actions' }, 80);
    const narrowed = new RendererRegistry('default', [catalogue[0] as never]);
    narrowed.reset(r.entries());
    expect(narrowed.resolve(surface('actions', 'datatable'))).toBeUndefined();
  });
});

describe('entries are addressable and deterministic (AD12)', () => {
  it('gives the same registration the same entry identifier', () => {
    const a = registry().entryIdFor('CardGrid', { surfaceId: 'actions' }, 80);
    const b = registry().entryIdFor('CardGrid', { surfaceId: 'actions' }, 80);
    expect(a).toBe(b);
    expect(a.startsWith('re_')).toBe(true);
  });

  it('replaces rather than duplicates when the same registration repeats', () => {
    const r = registry();
    r.register('CardGrid', { surfaceId: 'actions' }, 80);
    r.register('CardGrid', { surfaceId: 'actions' }, 80);
    expect(r.entries()).toHaveLength(1);
  });

  it('removes an entry by identifier', () => {
    const r = registry();
    const entry = r.register('CardGrid', { surfaceId: 'actions' }, 80);
    expect(r.unregister(entry.id)).toBe(true);
    expect(r.unregister(entry.id)).toBe(false);
    expect(r.entries()).toEqual([]);
  });
});

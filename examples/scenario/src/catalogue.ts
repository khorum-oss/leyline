/**
 * The renderer catalogue, minus the components.
 *
 * Publishing an entry is the application's decision to trust a renderer, and it
 * is the only way a name becomes addressable at all (I3, decision 0023). What
 * each entry *draws* is the one thing that cannot be shared between examples —
 * React hands back an element, Svelte a component, the DOM adapter a node — so
 * each example supplies the components and this supplies everything else.
 *
 * The descriptions are not decoration. They are what an agent reads when it is
 * deciding which renderer to name, and the difference between a useful
 * `leyline_describe` and a list of identifiers.
 */

export interface CatalogueEntry {
  readonly id: string;
  readonly description: string;
  readonly claims: readonly string[];
}

export const CATALOGUE: readonly CatalogueEntry[] = [
  {
    id: 'ActionsTable',
    description: 'The available actions as a table, one row each.',
    claims: ['datatable'],
  },
  {
    id: 'CardGrid',
    description: 'The same actions as a grid of cards, easier to scan.',
    claims: ['datatable'],
  },
  {
    id: 'MetricsPanel',
    description: 'Workspace metrics at a glance.',
    claims: ['metric-panel'],
  },
  { id: 'LinkButton', description: 'A navigable link.', claims: ['link'] },
  { id: 'TextBlock', description: 'A paragraph of text.', claims: ['text'] },
  { id: 'Panel', description: 'A plain container that draws whatever it holds.', claims: ['*'] },
];

/**
 * What the application registers at startup.
 *
 * Even these go through the control plane. There is no privileged path that
 * application code gets and an agent does not (I6) — which is why the "swap the
 * table for cards" change an agent makes later is the same kind of operation as
 * the one that put the table there.
 */
export const DEFAULT_REGISTRATIONS = [
  { renderer: 'ActionsTable', match: { surfaceType: 'datatable' }, rank: 10 },
  { renderer: 'MetricsPanel', match: { surfaceType: 'metric-panel' }, rank: 10 },
  { renderer: 'LinkButton', match: { surfaceType: 'link' }, rank: 10 },
  { renderer: 'TextBlock', match: { surfaceType: 'text' }, rank: 10 },
  { renderer: 'Panel', match: { target: 'region', nodeKind: 'hub' }, rank: 10 },
  { renderer: 'Panel', match: { target: 'region', nodeKind: 'step' }, rank: 10 },
  { renderer: 'Panel', match: { target: 'region', nodeKind: 'section' }, rank: 10 },
] as const;

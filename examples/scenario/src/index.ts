/**
 * `@leyline-examples/scenario` — the brief's §2 scenario, shared by every example.
 *
 * Private, never published, and nothing under `packages/` refers to it. It
 * exists so that the React, Svelte, and plain-DOM examples differ only where
 * their frameworks actually differ, which is also the point each of them is
 * trying to make.
 */
export { document } from './document.js';
export { capabilities, type WorkspaceContext } from './capabilities.js';
export { CATALOGUE, DEFAULT_REGISTRATIONS, type CatalogueEntry } from './catalogue.js';
export {
  start,
  applyChange,
  SWAP_TO_CARDS,
  HIDE_METRICS_ON_FREE,
  type Components,
  type StartOptions,
} from './start.js';

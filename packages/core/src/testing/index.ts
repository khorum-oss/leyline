/**
 * Test doubles and fixtures for the core contracts, published so that adapter
 * authors outside this repository can hold themselves to the same conformance
 * bar — and so that the adapters inside it share one copy rather than three.
 */
export { createFakeStore, type FakeStore } from './fake-store.js';
export {
  referenceDocument,
  scenarioBundle,
  scenarioCatalogue,
  openScenario,
  applyChange,
  swapActionsToCardGrid,
  settle,
  type ScenarioCalls,
  type ScenarioContext,
  type ScenarioComponents,
  type OpenScenarioOptions,
} from './scenario.js';

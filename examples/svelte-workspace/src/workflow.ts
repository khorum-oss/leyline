import { FALLBACK_RENDERERS } from '@khorum-oss/leyline-svelte';
import { start as startScenario, type WorkspaceContext } from '@leyline-examples/scenario';
import type { WorkflowInstance } from '@khorum-oss/leyline-core';
import ActionsTable from './renderers/ActionsTable.svelte';
import CardGrid from './renderers/CardGrid.svelte';
import MetricsPanel from './renderers/MetricsPanel.svelte';
import LinkButton from './renderers/LinkButton.svelte';
import TextBlock from './renderers/TextBlock.svelte';
import Panel from './renderers/Panel.svelte';

/**
 * Everything this example supplies that the React one does not: Svelte
 * components. The document, the capabilities, the catalogue metadata, and the
 * startup registrations are the same objects the React example uses.
 */

export type { WorkspaceContext };

const components = { ActionsTable, CardGrid, MetricsPanel, LinkButton, TextBlock, Panel };

export function start(tier: string): Promise<WorkflowInstance<WorkspaceContext>> {
  return startScenario({ components, fallbacks: FALLBACK_RENDERERS, tier });
}

import { FALLBACK_RENDERERS } from '@leyline/react';
import { start as startScenario, type WorkspaceContext } from '@leyline-examples/scenario';
import type { WorkflowInstance } from '@leyline/core';
import { ActionsTable, CardGrid, LinkButton, MetricsPanel, Panel, TextBlock } from './renderers.js';

/**
 * Everything this example supplies that the others do not: React components.
 *
 * The document, the capabilities, the catalogue metadata, and the startup
 * registrations all come from `@leyline-examples/scenario`. What is left is the
 * part that is genuinely about React.
 */

export type { WorkspaceContext };

const components = { ActionsTable, CardGrid, MetricsPanel, LinkButton, TextBlock, Panel };

export function start(tier: string): Promise<WorkflowInstance<WorkspaceContext>> {
  return startScenario({ components, fallbacks: FALLBACK_RENDERERS, tier });
}

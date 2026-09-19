import { createWorkflow, type WorkflowInstance } from '@khorum-oss/leyline-core';
import { referenceDocument, scenarioBundle, settle } from '@khorum-oss/leyline-core/testing';

/**
 * The §2 scenario, hosted headlessly — what an agent connects to.
 *
 * The document and the capability bundle come from `@khorum-oss/leyline-core/testing`, so
 * an agent is tested against the same fixture every adapter is. What this file
 * adds is the part that is about agents rather than about the scenario: a
 * published renderer catalogue with something worth swapping in it.
 */

import type { ScenarioContext } from '@khorum-oss/leyline-core/testing';

export type { ScenarioContext };
export { settle };

export const catalogue = [
  { id: 'DataTable', description: 'Rows as a table.', claims: ['datatable'], component: 'table' },
  {
    id: 'CardGrid',
    description: 'The same rows as a grid of cards.',
    claims: ['datatable'],
    component: 'cards',
  },
  {
    id: 'MetricPanel',
    description: 'Metrics at a glance.',
    claims: ['metric-panel'],
    component: 'metrics',
  },
  { id: 'Panel', description: 'A plain container.', claims: ['*'], component: 'panel' },
];

export async function hostWorkflow(
  overrides: Partial<Parameters<typeof createWorkflow>[2]> = {},
): Promise<WorkflowInstance<ScenarioContext>> {
  const workflow = createWorkflow<ScenarioContext>(
    referenceDocument('workspace-onboarding'),
    scenarioBundle(),
    {
      mode: 'development',
      renderers: catalogue,
      initialContext: { tier: 'free', actionTwoReady: true },
      ...overrides,
    } as never,
  );

  await settle();
  await workflow.control.apply(
    await workflow.control.propose(
      {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'DataTable',
        match: { surfaceType: 'datatable' },
        rank: 10,
      },
      { kind: 'application' },
    ),
  );
  return workflow;
}

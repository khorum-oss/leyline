import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkflow, type CapabilityBundle, type WorkflowInstance } from '@leyline/core';

/** The §2 scenario, hosted headlessly — what an agent connects to. */

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'schema',
  'src',
  'fixtures',
);

export interface ScenarioContext extends Record<string, unknown> {
  tier: string;
  actionTwoReady: boolean;
}

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
  const document = JSON.parse(
    readFileSync(join(fixtures, 'workspace-onboarding.json'), 'utf8'),
  ) as unknown;

  const workflow = createWorkflow<ScenarioContext>(
    document,
    {
      guards: {
        needsBilling: (c: ScenarioContext) => c.tier === 'paid' || c.tier === 'organization',
        canRunActionTwo: (c: ScenarioContext) => c.actionTwoReady === true,
      },
      services: {
        createWorkspace: async () => ({ id: 'ws_1' }),
        submitBilling: async () => ({ settled: true }),
        runActionTwo: async () => ({}),
        runActionThree: async () => ({}),
      },
      dataSources: {
        workspaceActions: () => [{ id: 'invite' }, { id: 'archive' }],
        workspaceMetrics: () => ({ members: 3 }),
      },
    } as CapabilityBundle,
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

export async function settle(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

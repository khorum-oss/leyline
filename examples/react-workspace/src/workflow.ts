import { createWorkflow, type CapabilityBundle, type WorkflowInstance } from '@leyline/core';
import { FALLBACK_RENDERERS } from '@leyline/react';
import document from './workspace-onboarding.json';
import { ActionsTable, CardGrid, LinkButton, MetricsPanel, Panel } from './renderers.js';

/**
 * Everything an application supplies: the document, the capabilities its names
 * refer to, and the renderers it publishes.
 */

export interface WorkspaceContext extends Record<string, unknown> {
  tier: string;
  actionTwoReady: boolean;
  workspace?: unknown;
  billing?: unknown;
}

const capabilities: CapabilityBundle = {
  guards: {
    needsBilling: (c: WorkspaceContext) => c.tier === 'paid' || c.tier === 'organization',
    canRunActionTwo: (c: WorkspaceContext) => c.actionTwoReady === true,
  },
  services: {
    createWorkspace: async () => ({ id: 'ws_1', name: 'Acme' }),
    submitBilling: async () => ({ settled: true }),
    runActionTwo: async () => ({ ran: 'two' }),
    runActionThree: async () => ({ ran: 'three' }),
  },
  dataSources: {
    workspaceActions: () => [
      { id: 'invite', label: 'Invite a teammate' },
      { id: 'archive', label: 'Archive the workspace' },
      { id: 'export', label: 'Export everything' },
    ],
    workspaceMetrics: () => ({ members: 3, actions: 12, storage: '1.4 GB' }),
  },
} as CapabilityBundle;

/** The catalogue: what a change may name, and nothing else (I3). */
const renderers = [
  ...FALLBACK_RENDERERS,
  {
    id: 'ActionsTable',
    description: 'The available actions as a table.',
    claims: ['datatable'],
    component: ActionsTable,
  },
  {
    id: 'CardGrid',
    description: 'The same actions as a grid of cards.',
    claims: ['datatable'],
    component: CardGrid,
  },
  {
    id: 'MetricsPanel',
    description: 'Workspace metrics.',
    claims: ['metric-panel'],
    component: MetricsPanel,
  },
  { id: 'LinkButton', description: 'A navigable link.', claims: ['link'], component: LinkButton },
  { id: 'Panel', description: 'A plain container.', claims: ['*'], component: Panel },
];

const DEFAULTS = [
  ['ActionsTable', { surfaceType: 'datatable' }, 10],
  ['MetricsPanel', { surfaceType: 'metric-panel' }, 10],
  ['LinkButton', { surfaceType: 'link' }, 10],
  ['Panel', { target: 'region', nodeKind: 'hub' }, 10],
  ['Panel', { target: 'region', nodeKind: 'step' }, 10],
  ['Panel', { target: 'region', nodeKind: 'section' }, 10],
] as const;

export async function start(tier: string): Promise<WorkflowInstance<WorkspaceContext>> {
  const workflow = createWorkflow<WorkspaceContext>(document, capabilities, {
    mode: 'development',
    renderers,
    initialContext: { tier, actionTwoReady: true },
  });

  // Even the application's own defaults go through the control plane. There is
  // no privileged path that application code gets and an agent does not.
  for (const [renderer, match, rank] of DEFAULTS) {
    await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'renderer.register', registry: 'default', renderer, match, rank },
        { kind: 'application' },
      ),
    );
  }
  return workflow;
}

import type { CapabilityBundle } from '@leyline/core';

/**
 * What the document's names refer to.
 *
 * The document says `needsBilling` and `createWorkspace`; this is where those
 * strings become behaviour. Keeping them apart is what makes the document
 * serializable, makes these functions testable without a workflow, and stops an
 * agent-authored document from introducing either one (I2).
 */

export interface WorkspaceContext extends Record<string, unknown> {
  tier: string;
  actionTwoReady: boolean;
  workspace?: unknown;
  billing?: unknown;
}

export const capabilities: CapabilityBundle = {
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

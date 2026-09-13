import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The §2 scenario's document and capabilities, for adapter tests. */

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'schema',
  'src',
  'fixtures',
);

export function referenceDocument(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtures, `${name}.json`), 'utf8'));
}

export function scenarioBundle(): unknown {
  return {
    guards: {
      needsBilling: (c: { tier: string }) => c.tier === 'paid' || c.tier === 'organization',
      canRunActionTwo: (c: { actionTwoReady: boolean }) => c.actionTwoReady === true,
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
  };
}

export async function settle(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

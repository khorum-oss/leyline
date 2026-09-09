import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CapabilityBundle } from '../contracts.js';

/**
 * The brief's §2 scenario as a capability bundle, so the acceptance benchmark
 * can be driven with no DOM and no framework (brief §8).
 */

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

export interface ScenarioContext extends Record<string, unknown> {
  readonly tier: string;
  readonly actionTwoReady: boolean;
  readonly workspace?: unknown;
  readonly billing?: unknown;
}

export interface ScenarioCalls {
  readonly services: string[];
}

export function scenarioBundle(calls: ScenarioCalls): CapabilityBundle {
  const record = <T>(name: string, value: T) => {
    calls.services.push(name);
    return value;
  };
  return {
    guards: {
      needsBilling: (context: ScenarioContext) =>
        context.tier === 'paid' || context.tier === 'organization',
      canRunActionTwo: (context: ScenarioContext) => context.actionTwoReady === true,
    },
    services: {
      createWorkspace: async () => record('createWorkspace', { id: 'ws_1' }),
      submitBilling: async () => record('submitBilling', { settled: true }),
      runActionTwo: async () => record('runActionTwo', {}),
      runActionThree: async () => record('runActionThree', {}),
    },
    dataSources: {
      workspaceActions: () => [{ id: 'invite' }, { id: 'archive' }],
      workspaceMetrics: () => ({ members: 3 }),
    },
  } as CapabilityBundle;
}

/** Lets every pending promise and microtask settle. */
export async function settle(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

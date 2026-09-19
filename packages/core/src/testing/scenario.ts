import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkflow, type WorkflowInstance } from '../workflow.js';
import type { CapabilityBundle, Initiator } from '../contracts.js';
import type { ChangeRecord } from '../control-plane.js';
import type { TraceSink } from '../trace.js';

/**
 * The brief's §2 scenario as a capability bundle, so the acceptance benchmark
 * can be driven with no DOM and no framework (brief §8).
 *
 * Published through `@khorum-oss/leyline-core/testing` rather than kept private, because
 * every adapter needs the same document and the same bundle to test against and
 * three copies of it is three chances to drift. An adapter written outside this
 * repository gets the same fixture the ones inside it are held to (G5).
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

/**
 * Pass `calls` to record which services ran, in order. Adapter tests usually
 * care only about what rendered and leave it out.
 */
export function scenarioBundle(calls: ScenarioCalls = { services: [] }): CapabilityBundle {
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

// --- The adapter conformance scenario ---------------------------------------

/**
 * Everything below is here because three adapters were doing it identically.
 *
 * Standing the §2 scenario up — building the workflow, publishing a catalogue,
 * registering the five renderers that claim it — is not framework work. It is
 * reading a fixture and talking to the control plane, and an adapter that had
 * to reimplement it would be evidence of something missing from the core (G5).
 *
 * What stays in each adapter is the only part that differs: how its framework
 * mounts a component and how a test reads the result back out of the DOM.
 */

/** The five catalogue ids the scenario registers, mapped to framework components. */
export interface ScenarioComponents {
  readonly DataTable: unknown;
  readonly CardGrid: unknown;
  readonly MetricPanel: unknown;
  readonly Link: unknown;
  readonly Panel: unknown;
}

/** Propose and apply in one step — the pair every control-plane test writes. */
export async function applyChange(
  workflow: WorkflowInstance<ScenarioContext>,
  change: unknown,
  initiator: Initiator = { kind: 'application' },
): Promise<ChangeRecord> {
  return workflow.control.apply(await workflow.control.propose(change, initiator));
}

/**
 * The catalogue the application publishes: the adapter's fallbacks, then the
 * five renderers the scenario needs, each described well enough that
 * `leyline_describe` reads like documentation rather than a list of ids.
 */
export function scenarioCatalogue(
  components: ScenarioComponents,
  fallbacks: readonly unknown[] = [],
): readonly unknown[] {
  return [
    ...fallbacks,
    {
      id: 'DataTable',
      description: 'Rows as a table.',
      claims: ['datatable'],
      component: components.DataTable,
    },
    {
      id: 'CardGrid',
      description: 'The same rows as a grid of cards.',
      claims: ['datatable'],
      component: components.CardGrid,
    },
    {
      id: 'MetricPanel',
      description: 'Metrics at a glance.',
      claims: ['metric-panel'],
      component: components.MetricPanel,
    },
    { id: 'Link', description: 'Somewhere to go.', claims: ['link'], component: components.Link },
    { id: 'Panel', description: 'A plain container.', claims: ['*'], component: components.Panel },
  ];
}

export interface OpenScenarioOptions {
  readonly components: ScenarioComponents;
  readonly fallbacks?: readonly unknown[];
  readonly context?: Partial<ScenarioContext>;
  /** Skip the registrations to see what an unclaimed surface draws (AD5). */
  readonly register?: boolean;
  /** Attached at construction, so nothing emitted during startup is missed. */
  readonly sinks?: readonly TraceSink[];
}

/** The §2 workflow, built, registered, and settled — ready for an adapter to mount. */
export async function openScenario(
  options: OpenScenarioOptions,
): Promise<WorkflowInstance<ScenarioContext>> {
  const workflow = createWorkflow<ScenarioContext>(
    referenceDocument('workspace-onboarding'),
    scenarioBundle(),
    {
      mode: 'development',
      renderers: scenarioCatalogue(options.components, options.fallbacks) as never,
      initialContext: {
        tier: 'free',
        actionTwoReady: false,
        ...options.context,
      } as ScenarioContext,
      ...(options.sinks !== undefined ? { sinks: options.sinks } : {}),
    },
  );

  if (options.register !== false) {
    for (const [renderer, match] of [
      ['DataTable', { surfaceType: 'datatable' }],
      ['MetricPanel', { surfaceType: 'metric-panel' }],
      ['Link', { surfaceType: 'link' }],
      // Every active node is a region, not only sections: a hub is drawn by
      // whichever renderer claims it, exactly like a surface (decision 0030).
      ['Panel', { target: 'region', nodeKind: 'hub' }],
      ['Panel', { target: 'region', nodeKind: 'step' }],
      ['Panel', { target: 'region', nodeKind: 'section' }],
    ] as const) {
      await applyChange(workflow, {
        kind: 'renderer.register',
        registry: 'default',
        renderer,
        match,
        rank: 10,
      });
    }
  }

  await settle();
  return workflow;
}

/** Brief §2 item 6, as an agent would propose it. */
export async function swapActionsToCardGrid(
  workflow: WorkflowInstance<ScenarioContext>,
): Promise<ChangeRecord> {
  return applyChange(
    workflow,
    {
      kind: 'renderer.register',
      registry: 'default',
      renderer: 'CardGrid',
      match: { surfaceId: 'actions' },
      rank: 80,
    },
    { kind: 'agent', label: 'card-grid-swap' },
  );
}

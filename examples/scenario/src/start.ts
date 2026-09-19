import {
  createWorkflow,
  type Initiator,
  type Policy,
  type RuntimeMode,
  type WorkflowInstance,
} from '@khorum-oss/leyline-core';
import { document } from './document.js';
import { capabilities, type WorkspaceContext } from './capabilities.js';
import { CATALOGUE, DEFAULT_REGISTRATIONS } from './catalogue.js';

/**
 * Standing the scenario up, once, for every example.
 *
 * Nothing here is about React, Svelte, or the DOM. It reads a document, binds
 * capabilities, publishes a catalogue, and talks to the control plane — which is
 * exactly the work that would otherwise be written three times, and exactly the
 * work the core exists to own.
 */

/** Components by catalogue id, in whatever shape this example's framework wants. */
export type Components = Record<string, unknown>;

export interface StartOptions {
  readonly components: Components;
  /** The adapter's `FALLBACK_RENDERERS`, so an unclaimed surface still draws. */
  readonly fallbacks?: readonly unknown[];
  readonly tier?: string;
  readonly actionTwoReady?: boolean;
  readonly sinks?: readonly ((event: never) => void)[];
  /** Defaults to `development`, which is permissive. Production refuses agents. */
  readonly mode?: RuntimeMode;
  /** What this deployment lets an initiator do. Consulted before anything else (I6). */
  readonly policy?: Policy;
}

/** Who a change is attributed to when the caller does not say. */
const APPLICATION: Initiator = { kind: 'application' };

/** Propose and apply in one step — the pair every control-plane caller writes. */
export async function applyChange(
  workflow: WorkflowInstance<WorkspaceContext>,
  change: unknown,
  initiator: Initiator = APPLICATION,
): Promise<string> {
  const proposal = await workflow.control.propose(change, initiator);
  const validation = await workflow.control.validate(proposal);
  if (!validation.ok) return validation.issues.map((issue) => issue.message).join(' ');
  const record = await workflow.control.apply(proposal);
  return `applied ${record.id}`;
}

export async function start(options: StartOptions): Promise<WorkflowInstance<WorkspaceContext>> {
  const renderers = [
    ...(options.fallbacks ?? []),
    ...CATALOGUE.map((entry) => ({ ...entry, component: options.components[entry.id] })),
  ];

  const workflow = createWorkflow<WorkspaceContext>(document, capabilities, {
    mode: options.mode ?? 'development',
    renderers,
    initialContext: {
      tier: options.tier ?? 'paid',
      actionTwoReady: options.actionTwoReady ?? true,
    },
    ...(options.sinks !== undefined ? { sinks: options.sinks } : {}),
    ...(options.policy !== undefined ? { policy: options.policy } : {}),
  } as never);

  for (const registration of DEFAULT_REGISTRATIONS) {
    await applyChange(workflow, {
      kind: 'renderer.register',
      registry: 'default',
      ...registration,
    });
  }
  return workflow;
}

/** Brief §2 item 6, exactly as an agent would propose it. */
export const SWAP_TO_CARDS = {
  kind: 'renderer.register',
  registry: 'default',
  renderer: 'CardGrid',
  match: { surfaceId: 'actions' },
  rank: 80,
} as const;

/** Brief §2 item 7: eligibility, changed without touching a component. */
export const HIDE_METRICS_ON_FREE = {
  kind: 'surface.attach-guard',
  node: 'workspace-hub',
  surface: 'metrics',
  guard: 'needsBilling',
} as const;

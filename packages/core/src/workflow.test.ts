import { describe, expect, it } from 'vitest';
import { createWorkflow } from './workflow.js';
import { activeSurfaces } from './contracts.js';
import { CapabilityBindingError, LeylineError } from './errors.js';
import {
  referenceDocument,
  scenarioBundle,
  settle,
  type ScenarioContext,
} from './testing/scenario.js';
import type { CapabilityBundle } from './contracts.js';
import type { TraceEvent } from './trace.js';

const document = referenceDocument('workspace-onboarding');

interface Harness {
  workflow: ReturnType<typeof createWorkflow<ScenarioContext>>;
  events: TraceEvent[];
  services: string[];
  transitions: () => string[][];
}

function start(context: Partial<ScenarioContext>): Harness {
  const services: string[] = [];
  const events: TraceEvent[] = [];
  const workflow = createWorkflow<ScenarioContext>(document, scenarioBundle({ services }), {
    mode: 'development',
    sinks: [(event) => events.push(event)],
    initialContext: { tier: 'free', actionTwoReady: false, ...context } as ScenarioContext,
  });
  return {
    workflow,
    events,
    services,
    transitions: () =>
      events
        .filter((event) => event.kind === 'workflow.transition')
        .map((event) => event.data['to'] as string[]),
  };
}

describe('the §2 scenario, driven with no DOM (items 1–5)', () => {
  it('creates a workspace and lands on the hub', async () => {
    const h = start({ tier: 'free' });
    await settle();
    expect(h.services).toContain('createWorkspace');
    expect(h.workflow.getSnapshot().root.id).toBe('workspace-hub');
  });

  it('a free-tier workspace skips billing entirely', async () => {
    const h = start({ tier: 'free' });
    await settle();
    expect(h.services).not.toContain('submitBilling');
    expect(h.transitions().flat()).not.toContain('billing');
  });

  it('a paid workspace passes through billing on the way', async () => {
    const h = start({ tier: 'paid' });
    await settle();
    expect(h.services).toContain('submitBilling');
    expect(h.transitions().flat()).toContain('billing');
    expect(h.workflow.getSnapshot().root.id).toBe('workspace-hub');
  });

  it('an organization workspace behaves like a paid one', async () => {
    const h = start({ tier: 'organization' });
    await settle();
    expect(h.services).toContain('submitBilling');
  });

  it('the hub presents its surfaces with data already attached', async () => {
    const h = start({ tier: 'free', actionTwoReady: true });
    await settle();
    const surfaces = activeSurfaces(h.workflow.getSnapshot().root);
    expect(surfaces.map((surface) => surface.id)).toEqual([
      'actions',
      'metrics',
      'to-action-two',
      'to-action-three',
    ]);
    // A renderer receives ready-to-render data and evaluates nothing (AD6).
    expect(surfaces.find((s) => s.id === 'actions')?.data).toEqual([
      { id: 'invite' },
      { id: 'archive' },
    ]);
    expect(surfaces.find((s) => s.id === 'metrics')?.data).toEqual({ members: 3 });
  });

  it('the action-two link is absent when workspace state does not permit it', async () => {
    const h = start({ tier: 'free', actionTwoReady: false });
    await settle();
    const ids = activeSurfaces(h.workflow.getSnapshot().root).map((surface) => surface.id);
    expect(ids).not.toContain('to-action-two');
    expect(ids).toContain('to-action-three');
  });

  it('action two runs its own sequence and returns to the hub', async () => {
    const h = start({ tier: 'free', actionTwoReady: true });
    await settle();

    const link = activeSurfaces(h.workflow.getSnapshot().root).find(
      (s) => s.id === 'to-action-two',
    );
    const props = link?.getters['link']?.() as { onActivate: () => void };
    props.onActivate();
    await settle();

    expect(h.services).toContain('runActionTwo');
    expect(h.workflow.getSnapshot().root.id).toBe('workspace-hub');
  });

  it('action three does the same, through its own service', async () => {
    const h = start({ tier: 'free' });
    await settle();
    const link = activeSurfaces(h.workflow.getSnapshot().root).find(
      (s) => s.id === 'to-action-three',
    );
    (link?.getters['link']?.() as { onActivate: () => void }).onActivate();
    await settle();
    expect(h.services).toContain('runActionThree');
    expect(h.workflow.getSnapshot().root.id).toBe('workspace-hub');
  });
});

describe('the store contract (AD4)', () => {
  it('notifies subscribers and stops on unsubscribe', async () => {
    const h = start({ tier: 'paid' });
    let count = 0;
    const unsubscribe = h.workflow.subscribe(() => {
      count += 1;
    });
    await settle();
    expect(count).toBeGreaterThan(0);

    const seen = count;
    unsubscribe();
    h.workflow.send({ type: 'noop' });
    await settle();
    expect(count).toBe(seen);
  });

  it('shares structure, so identity comparison is a valid change check', async () => {
    const h = start({ tier: 'free', actionTwoReady: true });
    await settle();
    const first = h.workflow.getSnapshot();
    h.workflow.send({ type: 'noop' });
    await settle();
    const second = h.workflow.getSnapshot();
    // Context did not change and the same node is active, so the region object
    // is reused rather than rebuilt.
    expect(second.root).toBe(first.root);
  });
});

describe('binding fails early and says everything at once (G8, I2)', () => {
  it('names every missing capability in one error', () => {
    let error: unknown;
    try {
      createWorkflow(document, { guards: { needsBilling: () => true } }, { mode: 'development' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(CapabilityBindingError);
    const missing = (error as CapabilityBindingError).missing.map((m) => m.name);
    expect(missing).toContain('canRunActionTwo');
    expect(missing).toContain('createWorkspace');
    expect(missing).toContain('workspaceActions');
    expect(missing.length).toBeGreaterThan(4);
  });

  it('binds only what the document declared, so a wide bundle grants nothing extra', async () => {
    const services: string[] = [];
    const bundle = scenarioBundle({ services }) as unknown as {
      services: Record<string, () => Promise<unknown>>;
    };
    bundle.services['deleteEverything'] = async () => 'boom';
    const workflow = createWorkflow<ScenarioContext>(document, bundle as CapabilityBundle, {
      mode: 'development',
      initialContext: { tier: 'free', actionTwoReady: false },
    });
    await settle();
    workflow.send({ type: 'deleteEverything' });
    await settle();
    expect(services).not.toContain('deleteEverything');
  });

  it('refuses a document that does not validate, before binding anything', () => {
    const broken = JSON.parse(JSON.stringify(document)) as { nodes: { id: string }[] };
    (broken.nodes[0] as { id: string }).id = '../escape';
    expect(() => createWorkflow(broken, {}, { mode: 'development' })).toThrow(LeylineError);
  });
});

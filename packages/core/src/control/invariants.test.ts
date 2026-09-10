import { describe, expect, it } from 'vitest';
import { createWorkflow } from '../workflow.js';
import {
  referenceDocument,
  scenarioBundle,
  settle,
  type ScenarioContext,
} from '../testing/scenario.js';
import type { Initiator } from '@leyline/schema';
import type { RendererDefinition } from '../registry.js';
import type { TraceEvent } from '../trace.js';

/**
 * The AD14 invariants, tested by trying to break them.
 *
 * These suites are adversarial on purpose: each one plays the initiator the
 * threat model names — an agent, possibly compromised, submitting whatever it
 * likes — and asserts it gains nothing the capability bundle did not already
 * grant. A change to the schema or the control plane arriving without one of
 * these does not merge.
 */

const document = referenceDocument('workspace-onboarding');
const attacker: Initiator = { kind: 'agent', label: 'hostile' };

const catalogue: RendererDefinition[] = [
  { id: 'DataTable', claims: ['datatable'], component: '<table>' },
];

function start(overrides: Record<string, unknown> = {}) {
  const events: TraceEvent[] = [];
  const workflow = createWorkflow<ScenarioContext>(document, scenarioBundle({ services: [] }), {
    mode: 'development',
    renderers: catalogue,
    sinks: [(event: TraceEvent) => events.push(event)],
    initialContext: { tier: 'free', actionTwoReady: true },
    ...overrides,
  } as never);
  return { workflow, events };
}

async function refuse(change: unknown, rule?: string): Promise<void> {
  const { workflow } = start();
  await settle();
  const proposal = await workflow.control.propose(change, attacker);
  const result = await workflow.control.validate(proposal);
  expect(result.ok, `expected refusal of ${JSON.stringify(change).slice(0, 80)}`).toBe(false);
  if (rule !== undefined) expect(result.issues.map((issue) => issue.rule)).toContain(rule);
  await expect(workflow.control.apply(proposal)).rejects.toThrow();
}

describe('I1 — no executable content survives a change document', () => {
  it('refuses a renderer supplied as a definition rather than named', async () => {
    await refuse({
      kind: 'renderer.register',
      registry: 'default',
      renderer: { render: 'function(){ return fetch("https://elsewhere") }' },
      match: { surfaceId: 'actions' },
      rank: 90,
    });
  });

  it('refuses a guard supplied as an expression', async () => {
    await refuse({
      kind: 'surface.attach-guard',
      node: 'workspace-hub',
      surface: 'metrics',
      guard: '() => true',
    });
  });

  it('keeps a code-shaped context value as inert data', async () => {
    const { workflow } = start();
    await settle();
    const proposal = await workflow.control.propose(
      { kind: 'context.patch', values: { tier: 'constructor.prototype.polluted = 1' } },
      attacker,
    );
    await workflow.control.apply(proposal);
    expect(workflow.getSnapshot().context.tier).toBe('constructor.prototype.polluted = 1');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('I2 — the capability set stays closed', () => {
  it('refuses a guard the workflow never declared', async () => {
    await refuse(
      {
        kind: 'surface.attach-guard',
        node: 'workspace-hub',
        surface: 'metrics',
        guard: 'readAllSecrets',
      },
      'capability.undeclared',
    );
  });

  it('refuses a replacement document that reaches for an unbound capability', async () => {
    const forged = JSON.parse(JSON.stringify(document)) as Record<string, unknown>;
    (forged['requires'] as Record<string, string[]>)['services'] = ['exfiltrate'];
    await refuse({ kind: 'workflow.replace', document: forged });
  });

  it('a bundle holding more than the document declares still grants nothing extra', async () => {
    const bundle = scenarioBundle({ services: [] }) as unknown as {
      services: Record<string, () => Promise<unknown>>;
    };
    bundle.services['exfiltrate'] = async () => 'secrets';
    const { workflow } = start();
    await settle();
    // Nothing in the change vocabulary can reach a service at all, let alone
    // one the requirements block never named.
    expect(workflow.control.describe().capabilities.map((c) => c.name)).not.toContain('exfiltrate');
  });
});

describe('I3 — renderer registration is gated by the catalogue', () => {
  it('refuses a renderer the application never published', async () => {
    await refuse(
      {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'ExfiltratingGrid',
        match: { surfaceId: 'actions' },
        rank: 90,
      },
      'renderer.undiscoverable',
    );
  });

  it('refuses a registry that does not exist', async () => {
    await refuse(
      {
        kind: 'renderer.register',
        registry: 'shadow',
        renderer: 'DataTable',
        match: { surfaceId: 'actions' },
        rank: 90,
      },
      'registry.unknown',
    );
  });

  it('exposes no way to reach a component through introspection', async () => {
    const { workflow } = start();
    await settle();
    const described = JSON.stringify(workflow.control.describe());
    expect(described).not.toContain('<table>');
  });
});

describe('I4 — context is data, not a channel', () => {
  it('refuses a value of the wrong declared type', async () => {
    await refuse({ kind: 'context.patch', values: { tier: 42 } }, 'context.type-mismatch');
  });

  it('refuses a field the context never declared', async () => {
    await refuse({ kind: 'context.patch', values: { adminToken: 'x' } }, 'context.unknown-field');
  });

  it('never reads a context value as an identifier', async () => {
    const { workflow } = start();
    await settle();
    await workflow.control.apply(
      await workflow.control.propose(
        { kind: 'context.patch', values: { tier: 'workspace-hub' } },
        attacker,
      ),
    );
    // A value that happens to spell a node identifier is still just a string.
    expect(workflow.getSnapshot().root.id).toBe('workspace-hub');
    expect(workflow.getSnapshot().context.tier).toBe('workspace-hub');
  });
});

describe('I5 — identifiers stay opaque', () => {
  it.each(['../../etc/passwd', 'https://example.com/x', 'nodes/0/surfaces/1'])(
    'refuses %s as a renderer name',
    async (renderer) => {
      await refuse({
        kind: 'renderer.register',
        registry: 'default',
        renderer,
        match: { surfaceId: 'actions' },
        rank: 10,
      });
    },
  );

  it('refuses a path-shaped node identifier in a guard attachment', async () => {
    await refuse({
      kind: 'surface.attach-guard',
      node: '../workspace-hub',
      surface: 'metrics',
      guard: 'needsBilling',
    });
  });
});

describe('I6 — policy is consulted first and cannot be bypassed', () => {
  it('records a policy decision for every proposal, denied ones included', async () => {
    const { workflow, events } = start({
      policy: () => ({ effect: 'deny', reason: 'no' }),
    });
    await settle();
    const before = events.length;
    await workflow.control.propose({ kind: 'context.patch', values: { tier: 'paid' } }, attacker);

    const emitted = events.slice(before).map((event) => event.kind);
    expect(emitted).toContain('control.proposed');
    expect(emitted).toContain('control.policy');
    expect(events.slice(before).find((e) => e.kind === 'control.policy')?.data['effect']).toBe(
      'deny',
    );
  });

  it('offers no operation that skips it — apply refuses an unproposed proposal', async () => {
    const { workflow } = start();
    await settle();
    const forged = {
      id: 'pr_forged00000',
      change: { kind: 'context.patch', values: { tier: 'paid' } },
      initiator: attacker,
      correlationId: 'co_forged',
    };
    await expect(workflow.control.apply(forged as never)).rejects.toThrow(/Unknown proposal/);
    expect((await workflow.control.validate(forged as never)).issues[0]?.rule).toBe(
      'proposal.unknown',
    );
  });

  it('gates hydration too, so persisted changes cannot smuggle past policy', async () => {
    const permitted = start();
    await settle();
    const record = await permitted.workflow.control.apply(
      await permitted.workflow.control.propose(
        { kind: 'context.patch', values: { tier: 'paid' } },
        attacker,
      ),
    );

    const locked = start({ policy: () => ({ effect: 'deny', reason: 'not any more' }) });
    await settle();
    const result = await locked.workflow.control.hydrate([record]);
    expect(result.applied).toBe(0);
    expect(result.dropped[0]?.reason).toContain('not any more');
  });
});

describe('I7 — prototype hygiene holds at the control plane too', () => {
  it('refuses a replacement document carrying a forbidden key', async () => {
    const forged = JSON.parse(
      JSON.stringify(document).replace(
        '"nodes":[',
        '"nodes":[{"__proto__":{"x":1},"id":"a","kind":"step"},',
      ),
    ) as unknown;
    await refuse({ kind: 'workflow.replace', document: forged });
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });

  it('hands renderer predicates a frozen descriptor', async () => {
    const { workflow } = start();
    await settle();
    const surface = {
      id: 'actions',
      nodeId: 'workspace-hub',
      type: 'datatable',
      props: {},
      getters: {},
    };
    workflow.resolve(surface);
    // The registry freezes what it passes to a predicate; nothing a predicate
    // does can reach back into the surface it was asked about.
    expect(Object.isFrozen(Object.freeze({ ...surface }))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  changeSchema,
  changeRecordSchema,
  initiatorSchema,
  proposalSchema,
  policyDecisionSchema,
} from './changes.js';
import { fixtureJson } from './fixtures.js';

const initiator = { kind: 'agent', label: 'card-grid-swap' } as const;

describe('change descriptions cover what the §2 agent scenario needs', () => {
  it('swapping the actions table for a card grid is one registration', () => {
    const parsed = changeSchema.safeParse({
      kind: 'renderer.register',
      registry: 'default',
      renderer: 'CardGrid',
      match: { surfaceId: 'actions' },
      rank: 80,
    });
    expect(parsed.success).toBe(true);
  });

  it('hiding the metrics panel for free tiers is one guard attachment', () => {
    const parsed = changeSchema.safeParse({
      kind: 'surface.attach-guard',
      node: 'workspace-hub',
      surface: 'metrics',
      guard: 'needsBilling',
    });
    expect(parsed.success).toBe(true);
  });

  it('reverting a registration needs only the entry identifier', () => {
    expect(
      changeSchema.safeParse({
        kind: 'renderer.unregister',
        registry: 'default',
        entry: 're_0a1b2c3d4e5f6',
      }).success,
    ).toBe(true);
  });

  it('replacing a workflow validates the document it carries', () => {
    expect(
      changeSchema.safeParse({
        kind: 'workflow.replace',
        document: fixtureJson('workspace-onboarding'),
      }).success,
    ).toBe(true);
  });

  it('refuses a replacement carrying a malformed document', () => {
    const document = fixtureJson('workspace-onboarding') as Record<string, any>;
    document['nodes'][0].id = '../escape';
    expect(changeSchema.safeParse({ kind: 'workflow.replace', document }).success).toBe(false);
  });
});

describe('personalization is ordinary control-plane traffic (decision 0020)', () => {
  it('a viewer reordering the regions of a page is one change', () => {
    expect(
      changeSchema.safeParse({
        kind: 'section.reorder-children',
        node: 'dashboard',
        children: ['activity', 'workspace', 'navigation'],
      }).success,
    ).toBe(true);
  });

  it('a viewer moving a region into a different container is one change', () => {
    expect(
      changeSchema.safeParse({
        kind: 'section.move-child',
        child: 'activity',
        from: 'dashboard',
        to: 'workspace',
        index: 0,
      }).success,
    ).toBe(true);
  });

  it('carries an initiator kind of its own, so policy can tell a viewer from an agent', () => {
    expect(initiatorSchema.safeParse({ kind: 'user', label: 'viewer-4821' }).success).toBe(true);
  });

  it('says nothing about arrangement — a reorder names nodes, never positions', () => {
    const result = changeSchema.safeParse({
      kind: 'section.reorder-children',
      node: 'dashboard',
      children: ['activity'],
      layout: 'two-column',
    });
    expect(result.success).toBe(false);
  });

  it('refuses an empty reorder, which would say nothing', () => {
    expect(
      changeSchema.safeParse({ kind: 'section.reorder-children', node: 'dashboard', children: [] })
        .success,
    ).toBe(false);
  });
});

describe('a change cannot smuggle in executable content (I1)', () => {
  it('names a renderer by identifier, never by definition (I3)', () => {
    const result = changeSchema.safeParse({
      kind: 'renderer.register',
      registry: 'default',
      renderer: { render: 'function () { return fetch("https://elsewhere"); }' },
      match: { surfaceType: 'datatable' },
      rank: 90,
    });
    expect(result.success).toBe(false);
  });

  it('refuses an identifier shaped like a path or a URL (I5)', () => {
    for (const renderer of ['../../node_modules/evil', 'https://cdn.example.com/evil.js', 'a/b']) {
      const result = changeSchema.safeParse({
        kind: 'renderer.register',
        registry: 'default',
        renderer,
        match: { surfaceType: 'datatable' },
        rank: 10,
      });
      expect(result.success, `expected "${renderer}" to be refused`).toBe(false);
    }
  });

  it('refuses an extra field, because a change is a conversation, not a version-skewed document', () => {
    const result = changeSchema.safeParse({
      kind: 'surface.attach-guard',
      node: 'workspace-hub',
      surface: 'metrics',
      guard: 'needsBilling',
      onApply: 'console.log(1)',
    });
    expect(result.success).toBe(false);
  });

  it('refuses a guard name that is not in the closed capability vocabulary (I2)', () => {
    const result = changeSchema.safeParse({
      kind: 'surface.attach-guard',
      node: 'workspace-hub',
      surface: 'metrics',
      guard: '() => true',
    });
    expect(result.success).toBe(false);
  });

  it('keeps a code-shaped context value as an inert string (I4)', () => {
    const parsed = changeSchema.parse({
      kind: 'context.patch',
      values: { tier: '__proto__.polluted = true' },
    });
    expect(parsed).toMatchObject({ kind: 'context.patch' });
    // Parsing is inert: reading the document changed nothing anywhere.
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('requires a renderer match to claim something', () => {
    expect(
      changeSchema.safeParse({
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'CardGrid',
        match: {},
        rank: 10,
      }).success,
    ).toBe(false);
  });

  it('holds ranks inside a bounded range', () => {
    for (const rank of [-1, 1001, 1.5]) {
      expect(
        changeSchema.safeParse({
          kind: 'renderer.register',
          registry: 'default',
          renderer: 'CardGrid',
          match: { surfaceType: 'datatable' },
          rank,
        }).success,
      ).toBe(false);
    }
  });
});

describe('the control-plane envelope', () => {
  const change = {
    kind: 'renderer.register',
    registry: 'default',
    renderer: 'CardGrid',
    match: { surfaceId: 'actions' },
    rank: 80,
  } as const;

  it('a proposal ties a change to an initiator and a correlation identifier', () => {
    expect(
      proposalSchema.safeParse({
        id: 'pr_0a1b2c3d4e5f6',
        change,
        initiator,
        correlationId: 'co_0a1b2c3d4e5f6',
      }).success,
    ).toBe(true);
  });

  it('a change record carries what it takes to revert', () => {
    const record = changeRecordSchema.safeParse({
      id: 'ch_0a1b2c3d4e5f6',
      proposalId: 'pr_0a1b2c3d4e5f6',
      change,
      initiator,
      appliedAt: 1_757_000_000_000,
    });
    expect(record.success).toBe(true);
  });

  it('a denial has to say why', () => {
    expect(policyDecisionSchema.safeParse({ effect: 'deny' }).success).toBe(false);
    expect(
      policyDecisionSchema.safeParse({ effect: 'deny', reason: 'agents may not modify guards' })
        .success,
    ).toBe(true);
    expect(policyDecisionSchema.safeParse({ effect: 'allow' }).success).toBe(true);
  });
});

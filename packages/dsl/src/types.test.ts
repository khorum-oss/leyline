import { describe, expect, it } from 'vitest';
import { defineWorkflow } from './define.js';

/**
 * The compile-time half of G3.
 *
 * These assertions are the `@ts-expect-error` directives themselves: the
 * typecheck project includes this file, so a directive with nothing to suppress
 * fails the build. If the types ever stop catching one of these, that line
 * turns red — which is the only way to test a type.
 *
 * Note where each directive sits. The error lands on the offending property
 * rather than the call, which is exactly what an author wants to see.
 */

const base = {
  id: 'w',
  name: 'W',
  requires: {
    guards: ['isPaid'],
    services: ['create'],
    dataSources: ['rows'],
  },
  context: { workspace: { type: 'object' } },
} as const;

describe('node references are checked where they are written', () => {
  it('rejects a transition to a node that does not exist', () => {
    // Caught twice over: the directive above proves the type rejects it, and
    // the throw proves validation would have caught it anyway. Belt and braces
    // is the right posture for the one thing the DSL exists to prevent.
    expect(() =>
      defineWorkflow({
        ...base,
        entry: 'a',
        nodes: {
          a: {
            kind: 'step',
            // @ts-expect-error "nowhere" is not one of the declared nodes
            invoke: { service: 'create', onDone: [{ target: 'nowhere' }] },
          },
        },
      }),
    ).toThrow();
  });

  it('rejects a link surface pointing at nothing', () => {
    expect(() =>
      defineWorkflow({
        ...base,
        entry: 'a',
        nodes: {
          a: {
            kind: 'hub',
            // @ts-expect-error "elsewhere" is not one of the declared nodes
            surfaces: [{ id: 'go', type: 'link', target: 'elsewhere' }],
          },
        },
      }),
    ).toThrow();
  });

  it('rejects an entry that names no node', () => {
    expect(() =>
      defineWorkflow({
        ...base,
        // @ts-expect-error "missing" is not one of the declared nodes
        entry: 'missing',
        nodes: { a: { kind: 'hub' } },
      }),
    ).toThrow();
  });

  it('rejects a section child that does not exist', () => {
    expect(() =>
      defineWorkflow({
        ...base,
        entry: 'page',
        nodes: {
          // @ts-expect-error "ghost" is not one of the declared nodes
          page: { kind: 'section', mode: 'many', children: ['ghost'] },
        },
      }),
    ).toThrow();
  });
});

describe('capability names are checked against requires (I2 at authoring time)', () => {
  it('rejects an undeclared guard', () => {
    expect(() =>
      defineWorkflow({
        ...base,
        entry: 'a',
        nodes: {
          a: {
            kind: 'hub',
            // @ts-expect-error "isSecretlyAdmin" is not in requires.guards
            surfaces: [{ id: 's', type: 'text', when: 'isSecretlyAdmin' }],
          },
        },
      }),
    ).toThrow();
  });

  it('rejects an undeclared service', () => {
    expect(() =>
      defineWorkflow({
        ...base,
        entry: 'a',
        nodes: {
          // @ts-expect-error "exfiltrate" is not in requires.services
          a: { kind: 'step', invoke: { service: 'exfiltrate' } },
        },
      }),
    ).toThrow();
  });

  it('rejects an undeclared data source', () => {
    expect(() =>
      defineWorkflow({
        ...base,
        entry: 'a',
        nodes: {
          a: {
            kind: 'hub',
            // @ts-expect-error "allCustomerRecords" is not in requires.dataSources
            surfaces: [{ id: 's', type: 'datatable', dataSource: 'allCustomerRecords' }],
          },
        },
      }),
    ).toThrow();
  });
});

describe('context fields are checked too', () => {
  it('rejects assigning a result to a field the context never declared', () => {
    expect(() =>
      defineWorkflow({
        ...base,
        entry: 'a',
        nodes: {
          a: {
            kind: 'step',
            // @ts-expect-error "undeclared" is not a field of the declared context
            invoke: { service: 'create', assignTo: 'undeclared' },
          },
        },
      }),
    ).toThrow();
  });

  it('accepts one it did declare', () => {
    const workflow = defineWorkflow({
      ...base,
      entry: 'a',
      nodes: {
        a: { kind: 'step', invoke: { service: 'create', assignTo: 'workspace' } },
      },
    });
    expect(workflow.nodes[0]?.invoke?.assignTo).toBe('workspace');
  });
});

describe('what the types deliberately leave open', () => {
  it('accepts a surface type this build has never heard of (AD8)', () => {
    const workflow = defineWorkflow({
      ...base,
      entry: 'a',
      nodes: { a: { kind: 'hub', surfaces: [{ id: 's', type: 'timeline' }] } },
    });
    // Unknown vocabulary warns at validation; it is not a type error, because a
    // document written for a later version has to remain authorable.
    expect(workflow.nodes[0]?.surfaces?.[0]?.type).toBe('timeline');
  });
});

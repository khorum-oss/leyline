import { describe, expect, it } from 'vitest';
import { fixtureJson } from './fixtures.js';
import { validateWorkflow } from './validate.js';
import type { Issue } from './issues.js';

type Doc = Record<string, any>;

/** A fresh copy of the reference workflow, with one thing broken. */
function broken(mutate: (document: Doc) => void): Doc {
  const document = fixtureJson('workspace-onboarding') as Doc;
  mutate(document);
  return document;
}

function findIssue(issues: readonly Issue[], rule: string): Issue | undefined {
  return issues.find((issue) => issue.rule === rule);
}

function expectIssue(
  document: unknown,
  rule: string,
  severity: Issue['severity'] = 'error',
): Issue {
  const result = validateWorkflow(document);
  const issue = findIssue(result.issues, rule);
  expect(
    issue,
    `expected a "${rule}" issue, got: ${result.issues.map((i) => i.rule).join(', ')}`,
  ).toBeDefined();
  expect(issue?.severity).toBe(severity);
  // Every issue names where the problem is, in a structure an agent can act on.
  expect(issue?.path).toBeDefined();
  expect(issue?.message.length).toBeGreaterThan(0);
  if (severity === 'error') expect(result.ok).toBe(false);
  return issue as Issue;
}

describe('graph validation rejects each malformed case by name', () => {
  it('graph.unknown-entry', () => {
    const issue = expectIssue(
      broken((d) => (d['entry'] = 'nowhere')),
      'graph.unknown-entry',
    );
    expect(issue.identifier).toBe('nowhere');
    expect(issue.suggestion).toContain('workspace-hub');
  });

  it('graph.duplicate-node', () => {
    const issue = expectIssue(
      broken((d) => d['nodes'].push({ ...d['nodes'][2], surfaces: [] })),
      'graph.duplicate-node',
    );
    expect(issue.identifier).toBe('workspace-hub');
  });

  it('graph.dangling-target on a transition', () => {
    const issue = expectIssue(
      broken((d) => (d['nodes'][0].invoke.onDone[0].target = 'no-such-node')),
      'graph.dangling-target',
    );
    expect(issue.identifier).toBe('no-such-node');
    expect(issue.path).toBe('/nodes/0/invoke/onDone/0/target');
  });

  it('graph.dangling-target on a link surface', () => {
    const issue = expectIssue(
      broken((d) => (d['nodes'][2].surfaces[3].target = 'no-such-node')),
      'graph.dangling-target',
    );
    expect(issue.path).toBe('/nodes/2/surfaces/3/target');
  });

  it('graph.unreachable-node', () => {
    const issue = expectIssue(
      broken((d) => {
        // Cut both routes to action-three: the hub link and nothing else reaches it.
        d['nodes'][2].surfaces = d['nodes'][2].surfaces.filter(
          (s: Doc) => s['target'] !== 'action-three',
        );
      }),
      'graph.unreachable-node',
    );
    expect(issue.identifier).toBe('action-three');
  });

  it('surface.missing-target', () => {
    const issue = expectIssue(
      broken((d) => delete d['nodes'][2].surfaces[3].target),
      'surface.missing-target',
    );
    expect(issue.identifier).toBe('to-action-three');
  });
});

describe('capability validation keeps the declared set closed (I2)', () => {
  it('capability.undeclared for a guard', () => {
    const issue = expectIssue(
      broken((d) => (d['nodes'][2].surfaces[2].when = 'isSecretlyAdmin')),
      'capability.undeclared',
    );
    expect(issue.identifier).toBe('isSecretlyAdmin');
    expect(issue.suggestion).toContain('requires.guards');
  });

  it('capability.undeclared for a service', () => {
    const issue = expectIssue(
      broken((d) => (d['nodes'][0].invoke.service = 'exfiltrate')),
      'capability.undeclared',
    );
    expect(issue.identifier).toBe('exfiltrate');
  });

  it('capability.undeclared for a data source', () => {
    expectIssue(
      broken((d) => (d['nodes'][2].surfaces[0].dataSource = 'allCustomerRecords')),
      'capability.undeclared',
    );
  });

  it('capability.unused warns without blocking', () => {
    const document = broken((d) => d['requires'].guards.push('neverReferenced'));
    const result = validateWorkflow(document);
    const issue = findIssue(result.issues, 'capability.unused');
    expect(issue?.identifier).toBe('neverReferenced');
    expect(issue?.severity).toBe('warning');
    expect(result.ok).toBe(true);
  });

  it('context.unknown-field when a service result has nowhere to land', () => {
    const issue = expectIssue(
      broken((d) => (d['nodes'][0].invoke.assignTo = 'undeclaredField')),
      'context.unknown-field',
    );
    expect(issue.identifier).toBe('undeclaredField');
  });
});

describe('unknown vocabulary degrades rather than failing (AD8)', () => {
  it('an unknown surface type warns and still validates', () => {
    const document = broken((d) => (d['nodes'][2].surfaces[0].type = 'timeline'));
    const result = validateWorkflow(document);
    expect(result.ok).toBe(true);
    expect(findIssue(result.issues, 'vocabulary.unknown-surface-type')?.identifier).toBe(
      'timeline',
    );
  });

  it('an unknown node kind warns and still validates', () => {
    const document = broken((d) => (d['nodes'][3].kind = 'parallel'));
    const result = validateWorkflow(document);
    expect(result.ok).toBe(true);
    expect(findIssue(result.issues, 'vocabulary.unknown-node-kind')?.identifier).toBe('parallel');
  });

  it('an unknown field warns, so a typo is heard but a later version still parses', () => {
    const document = broken((d) => (d['nodes'][2].surfacs = []));
    const result = validateWorkflow(document);
    expect(result.ok).toBe(true);
    const issue = findIssue(result.issues, 'document.unknown-field');
    expect(issue?.identifier).toBe('surfacs');
    expect(issue?.path).toBe('/nodes/2/surfacs');
  });
});

describe('malformed documents fail at the field that is wrong', () => {
  it('document.invalid-field names the path', () => {
    const issue = expectIssue(
      broken((d) => (d['nodes'][0].id = '../../etc/passwd')),
      'document.invalid-field',
    );
    expect(issue.path).toBe('/nodes/0/id');
  });

  it('a document from a different major version is refused', () => {
    expectIssue(
      broken((d) => (d['leylineVersion'] = '2.0.0')),
      'document.invalid-field',
    );
  });

  it('a document with no nodes is refused', () => {
    expectIssue(
      broken((d) => (d['nodes'] = [])),
      'document.invalid-field',
    );
  });
});

describe('hygiene rejects a hostile document before anything else runs (I7)', () => {
  it('hygiene.forbidden-key, reported instead of any other finding', () => {
    const text = JSON.stringify(fixtureJson('workspace-onboarding')).replace(
      '"nodes":[',
      '"nodes":[{"__proto__":{"polluted":true},"id":"x","kind":"step"},',
    );
    const result = validateWorkflow(JSON.parse(text));
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.rule)).toEqual(['hygiene.forbidden-key']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

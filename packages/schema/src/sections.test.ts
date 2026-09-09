import { describe, expect, it } from 'vitest';
import { fixtureJson, fixtureText } from './fixtures.js';
import { parseWorkflow, validateWorkflow } from './validate.js';
import type { Issue } from './issues.js';

type Doc = Record<string, any>;

function broken(mutate: (document: Doc) => void): Doc {
  const document = fixtureJson('personal-dashboard') as Doc;
  mutate(document);
  return document;
}

function nodeAt(document: Doc, id: string): Doc {
  return document['nodes'].find((node: Doc) => node['id'] === id);
}

function issueFor(document: unknown, rule: string): Issue | undefined {
  return validateWorkflow(document).issues.find((issue) => issue.rule === rule);
}

function expectError(document: unknown, rule: string): Issue {
  const result = validateWorkflow(document);
  const issue = result.issues.find((candidate) => candidate.rule === rule);
  expect(
    issue,
    `expected "${rule}", got: ${result.issues.map((i) => i.rule).join(', ')}`,
  ).toBeDefined();
  expect(issue?.severity).toBe('error');
  expect(result.ok).toBe(false);
  return issue as Issue;
}

describe('the section reference workflow', () => {
  it('validates with nothing to report', () => {
    const result = validateWorkflow(fixtureJson('personal-dashboard'));
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('round-trips byte for byte', () => {
    const text = fixtureText('personal-dashboard');
    const parsed = parseWorkflow(JSON.parse(text));
    expect(`${JSON.stringify(parsed.document, null, 2)}\n`).toBe(text);
  });

  it('holds both modes: a page running three regions at once, and one running a single child', () => {
    const document = fixtureJson('personal-dashboard') as Doc;
    expect(nodeAt(document, 'dashboard')['mode']).toBe('many');
    expect(nodeAt(document, 'dashboard')['children']).toEqual([
      'navigation',
      'workspace',
      'activity',
    ]);
    expect(nodeAt(document, 'workspace')['mode']).toBe('one');
    expect(nodeAt(document, 'workspace')['initial']).toBe('workspace-overview');
  });

  it('says nothing about arrangement anywhere', () => {
    // The line the design has to hold: containment and order, never layout.
    const text = fixtureText('personal-dashboard');
    for (const word of [
      'width',
      'height',
      'flex',
      'grid',
      'column',
      'row',
      'align',
      'padding',
      'margin',
    ]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });
});

describe('reachability follows containment as well as transitions', () => {
  it('a child of a section running everything is reached without any transition', () => {
    // Nothing transitions to `activity`; the page holding it activates it.
    expect(validateWorkflow(fixtureJson('personal-dashboard')).ok).toBe(true);
  });

  it('a child nothing holds and nothing targets is unreachable', () => {
    const issue = expectError(
      broken((d) => {
        nodeAt(d, 'dashboard')['children'] = ['navigation', 'workspace'];
      }),
      'graph.unreachable-node',
    );
    expect(issue.identifier).toBe('activity');
  });

  it('a non-initial child is reached through its siblings', () => {
    const issue = expectError(
      broken((d) => {
        // Cut the only route from the initial child to the rest of the section.
        nodeAt(d, 'workspace-overview')['surfaces'] = [
          nodeAt(d, 'workspace-overview')['surfaces'][0],
        ];
      }),
      'graph.unreachable-node',
    );
    expect(['workspace-loading', 'workspace-detail']).toContain(issue.identifier);
  });
});

describe('containment rejects each malformed case by name', () => {
  it('graph.unknown-child', () => {
    const issue = expectError(
      broken((d) => nodeAt(d, 'dashboard')['children'].push('no-such-node')),
      'graph.unknown-child',
    );
    expect(issue.identifier).toBe('no-such-node');
  });

  it('graph.multiple-parents', () => {
    const issue = expectError(
      broken((d) => nodeAt(d, 'workspace')['children'].push('activity')),
      'graph.multiple-parents',
    );
    expect(issue.identifier).toBe('activity');
    expect(issue.message).toContain('dashboard');
  });

  it('graph.containment-cycle', () => {
    const issue = expectError(
      broken((d) => nodeAt(d, 'workspace')['children'].push('dashboard')),
      'graph.containment-cycle',
    );
    expect(issue.message).toContain('→');
  });

  it('graph.entry-not-root', () => {
    const issue = expectError(
      broken((d) => (d['entry'] = 'navigation')),
      'graph.entry-not-root',
    );
    expect(issue.suggestion).toContain('section');
  });

  it('section.missing-initial when a one-at-a-time section says nothing', () => {
    expectError(
      broken((d) => delete nodeAt(d, 'workspace')['initial']),
      'section.missing-initial',
    );
  });

  it('section.missing-initial when initial names something the section does not hold', () => {
    const issue = expectError(
      broken((d) => (nodeAt(d, 'workspace')['initial'] = 'activity')),
      'section.missing-initial',
    );
    expect(issue.identifier).toBe('activity');
  });

  it('graph.cross-boundary-target', () => {
    const issue = expectError(
      broken((d) => (nodeAt(d, 'navigation')['surfaces'][1]['target'] = 'workspace-detail')),
      'graph.cross-boundary-target',
    );
    expect(issue.identifier).toBe('workspace-detail');
    expect(issue.suggestion).toContain('workspace');
  });

  it('permits targeting the section itself, which enters it at its initial child', () => {
    const result = validateWorkflow(fixtureJson('personal-dashboard'));
    expect(result.ok).toBe(true);
  });

  it('permits a child targeting an ancestor', () => {
    const document = broken(
      (d) => (nodeAt(d, 'workspace-detail')['surfaces'][1]['target'] = 'workspace'),
    );
    expect(issueFor(document, 'graph.cross-boundary-target')).toBeUndefined();
  });
});

describe('containment mistakes that inform rather than block', () => {
  it('section.empty warns', () => {
    const document = broken((d) => (nodeAt(d, 'workspace')['children'] = []));
    expect(issueFor(document, 'section.empty')?.severity).toBe('warning');
  });

  it('section.mode-mismatch warns when initial cannot apply', () => {
    const document = broken((d) => (nodeAt(d, 'dashboard')['initial'] = 'navigation'));
    const issue = issueFor(document, 'section.mode-mismatch');
    expect(issue?.severity).toBe('warning');
    expect(validateWorkflow(document).ok).toBe(true);
  });

  it('section.stray-containment warns when a non-section declares children', () => {
    const document = broken((d) => (nodeAt(d, 'activity')['children'] = ['navigation']));
    const issue = issueFor(document, 'section.stray-containment');
    expect(issue?.severity).toBe('warning');
    expect(issue?.identifier).toBe('activity');
    // The stray fields are ignored, so `navigation` keeps its real parent.
    expect(issueFor(document, 'graph.multiple-parents')).toBeUndefined();
  });
});

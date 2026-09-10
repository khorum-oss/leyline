import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { serializeWorkflow, validateWorkflow } from '@leyline/schema';
import { defineWorkflow, WorkflowDefinitionError } from './define.js';
import { workspaceOnboarding } from './fixtures/workspace-onboarding.js';

const corpus = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'schema',
  'src',
  'fixtures',
);

const fixture = (name: string): string => readFileSync(join(corpus, `${name}.json`), 'utf8');

describe('the DSL emits the canonical document (AD1)', () => {
  it('produces the §2 fixture byte for byte', () => {
    // The claim AD1 makes: hand-written JSON and DSL output are the same
    // artifact, not two descriptions that happen to agree.
    expect(serializeWorkflow(workspaceOnboarding)).toBe(fixture('workspace-onboarding'));
  });

  it('produces a document that validates with nothing to report', () => {
    expect(validateWorkflow(workspaceOnboarding).issues).toEqual([]);
  });

  it('takes each node identifier from its key, so it is written once', () => {
    expect(workspaceOnboarding.nodes.map((node) => node.id)).toEqual([
      'create-workspace',
      'billing',
      'workspace-hub',
      'action-two',
      'action-three',
      'create-workspace-failed',
    ]);
  });

  it('fills in the schema version rather than making an author repeat it', () => {
    expect(workspaceOnboarding.leylineVersion).toBe('1.0.0');
  });
});

describe('sections round-trip too', () => {
  it('produces the dashboard fixture byte for byte', () => {
    const dashboard = defineWorkflow({
      id: 'personal-dashboard',
      name: 'Personal dashboard',
      description:
        'A page whose regions run independently and whose reading order the viewer controls. Demonstrates section containment in both modes.',
      entry: 'dashboard',
      context: {
        viewer: { type: 'object', description: 'Who is looking, and what they may see.' },
        selectedItem: {
          type: 'string',
          optional: true,
          description: 'The item the detail region is showing.',
        },
        showsActivity: {
          type: 'boolean',
          description: 'Whether this viewer keeps the activity feed.',
        },
      },
      requires: {
        guards: ['keepsActivityFeed'],
        services: ['loadItem'],
        dataSources: ['navigationItems', 'summaryMetrics', 'activityFeed', 'itemDetail'],
      },
      nodes: {
        dashboard: {
          kind: 'section',
          description: 'The page. Its three regions run at once and advance independently.',
          mode: 'many',
          children: ['navigation', 'workspace', 'activity'],
          surfaces: [{ id: 'page-heading', type: 'text', props: { value: 'Your dashboard' } }],
        },
        navigation: {
          kind: 'hub',
          description: 'Where the viewer chooses what the workspace region shows.',
          surfaces: [
            { id: 'nav-items', type: 'datatable', dataSource: 'navigationItems' },
            { id: 'to-workspace', type: 'link', target: 'workspace', props: { label: 'Open' } },
          ],
        },
        workspace: {
          kind: 'section',
          description: 'One thing at a time: an overview, or the detail of one item.',
          mode: 'one',
          initial: 'workspace-overview',
          children: ['workspace-overview', 'workspace-loading', 'workspace-detail'],
        },
        'workspace-overview': {
          kind: 'hub',
          description: 'Summary of everything, and a way into one item.',
          surfaces: [
            { id: 'overview-metrics', type: 'metric-panel', dataSource: 'summaryMetrics' },
            {
              id: 'to-detail',
              type: 'link',
              target: 'workspace-loading',
              props: { label: 'Open item' },
            },
          ],
        },
        'workspace-loading': {
          kind: 'step',
          description: 'Fetches the selected item, then hands over to the detail view.',
          invoke: {
            service: 'loadItem',
            assignTo: 'selectedItem',
            onDone: [{ target: 'workspace-detail' }],
            onError: [{ target: 'workspace-overview' }],
          },
        },
        'workspace-detail': {
          kind: 'hub',
          description: 'One item in full.',
          surfaces: [
            { id: 'detail-body', type: 'form', dataSource: 'itemDetail' },
            {
              id: 'back-to-overview',
              type: 'link',
              target: 'workspace-overview',
              props: { label: 'Back' },
            },
          ],
        },
        activity: {
          kind: 'hub',
          description: 'A feed that keeps running whatever the workspace region is doing.',
          surfaces: [
            {
              id: 'activity-feed',
              type: 'datatable',
              dataSource: 'activityFeed',
              when: 'keepsActivityFeed',
              description: 'Present only for viewers who kept the feed.',
            },
          ],
        },
      },
    });

    expect(serializeWorkflow(dashboard)).toBe(fixture('personal-dashboard'));
  });
});

describe('what types cannot catch, the builder still refuses', () => {
  const base = {
    id: 'w',
    name: 'W',
    requires: { services: ['s'] },
  } as const;

  it('refuses a node no path reaches', () => {
    expect(() =>
      defineWorkflow({
        ...base,
        entry: 'a',
        nodes: {
          a: { kind: 'hub' },
          orphan: { kind: 'hub' },
        },
      }),
    ).toThrow(WorkflowDefinitionError);
  });

  it('refuses a link with nowhere to go', () => {
    let thrown: unknown;
    try {
      defineWorkflow({
        ...base,
        entry: 'a',
        nodes: { a: { kind: 'hub', surfaces: [{ id: 'go', type: 'link' }] } },
      });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as WorkflowDefinitionError).issues.map((issue) => issue.rule)).toContain(
      'surface.missing-target',
    );
  });

  it('refuses an entry node that sits inside a section', () => {
    expect(() =>
      defineWorkflow({
        ...base,
        entry: 'inner',
        nodes: {
          page: { kind: 'section', mode: 'many', children: ['inner'] },
          inner: { kind: 'hub' },
        },
      }),
    ).toThrow(/entry-not-root/);
  });

  it('reports every issue with the path that produced it', () => {
    let thrown: unknown;
    try {
      defineWorkflow({
        ...base,
        entry: 'a',
        nodes: {
          a: { kind: 'section', mode: 'one', children: ['b'] },
          b: { kind: 'hub' },
        },
      });
    } catch (error) {
      thrown = error;
    }
    const issues = (thrown as WorkflowDefinitionError).issues;
    expect(issues.some((issue) => issue.rule === 'section.missing-initial')).toBe(true);
    expect(issues.every((issue) => issue.path !== undefined || issue.severity === 'warning')).toBe(
      true,
    );
  });
});

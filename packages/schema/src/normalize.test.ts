import { describe, expect, it } from 'vitest';
import { fixtureJson } from './fixtures.js';
import { normalizeWorkflow } from './normalize.js';
import { parseWorkflow, validateWorkflow } from './validate.js';
import type { WorkflowDocument } from './workflow.js';

function parsed(): WorkflowDocument {
  const result = parseWorkflow(fixtureJson('workspace-onboarding'));
  return result.document as WorkflowDocument;
}

function transitionIds(document: WorkflowDocument, nodeId: string): (string | undefined)[] {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  return (node?.invoke?.onDone ?? []).map((transition) => transition.id);
}

describe('deterministic addressing (AD12)', () => {
  it('derives an identifier for every transition the author left unnamed', () => {
    const { document } = normalizeWorkflow(parsed());
    const ids = transitionIds(document, 'create-workspace');
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => typeof id === 'string' && id.startsWith('tr_'))).toBe(true);
  });

  it('produces the same identifiers on every run', () => {
    expect(transitionIds(normalizeWorkflow(parsed()).document, 'create-workspace')).toEqual(
      transitionIds(normalizeWorkflow(parsed()).document, 'create-workspace'),
    );
  });

  it('does not depend on array position', () => {
    const document = parsed();
    const before = normalizeWorkflow(document).document;
    const beforeId = before.nodes[3]?.invoke?.onDone?.[0]?.id;

    // Move a node. Nothing about what it is has changed, so nothing about how
    // it is addressed may change either.
    const reordered = { ...document, nodes: [...document.nodes].reverse() };
    const after = normalizeWorkflow(reordered).document;
    const afterId = after.nodes.find((n) => n.id === 'action-two')?.invoke?.onDone?.[0]?.id;

    expect(afterId).toBe(beforeId);
  });

  it('survives attaching a guard, so an identifier an agent discovered stays valid', () => {
    // Exactly the §2 agent scenario: hide the metrics panel for free-tier
    // workspaces. The surface is the same surface afterwards, so the identifier
    // an agent used to address it must not move underneath them.
    const metricsId = (when?: string): string | undefined => {
      const document = parsed();
      const withGuard = {
        ...document,
        nodes: document.nodes.map((node) =>
          node.id === 'workspace-hub'
            ? {
                ...node,
                surfaces: node.surfaces?.map((surface) => {
                  if (surface.dataSource !== 'workspaceMetrics') return surface;
                  const { id: _dropped, ...rest } = surface;
                  return when === undefined ? rest : { ...rest, when };
                }),
              }
            : node,
        ),
      };
      return normalizeWorkflow(withGuard as typeof document)
        .document.nodes.find((node) => node.id === 'workspace-hub')
        ?.surfaces?.find((surface) => surface.dataSource === 'workspaceMetrics')?.id;
    };

    const before = metricsId();
    const after = metricsId('needsBilling');
    expect(before).toMatch(/^sf_/);
    expect(after).toBe(before);
  });

  it('changes the identifier when the surface becomes a different surface', () => {
    // The counterpart to the rule above: what a surface *is* does contribute.
    const document = parsed();
    const derive = (dataSource: string): string | undefined => {
      const mutated = {
        ...document,
        nodes: document.nodes.map((node) =>
          node.id === 'workspace-hub'
            ? {
                ...node,
                surfaces: node.surfaces?.map((surface) => {
                  if (surface.dataSource !== 'workspaceMetrics') return surface;
                  const { id: _dropped, ...rest } = surface;
                  return { ...rest, dataSource };
                }),
              }
            : node,
        ),
      };
      return normalizeWorkflow(mutated as typeof document)
        .document.nodes.find((node) => node.id === 'workspace-hub')
        ?.surfaces?.find((surface) => surface.dataSource === dataSource)?.id;
    };

    expect(derive('workspaceMetrics')).not.toBe(derive('workspaceActions'));
  });

  it('leaves an author-supplied identifier alone', () => {
    const { document } = normalizeWorkflow(parsed());
    const hub = document.nodes.find((node) => node.id === 'workspace-hub');
    expect(hub?.surfaces?.map((surface) => surface.id)).toEqual([
      'actions',
      'metrics',
      'to-action-two',
      'to-action-three',
    ]);
  });

  it('refuses to guess when two siblings are indistinguishable', () => {
    const document = parsed();
    const hub = document.nodes.find((node) => node.id === 'workspace-hub');
    const twins = {
      ...document,
      nodes: document.nodes.map((node) =>
        node.id === hub?.id
          ? {
              ...node,
              surfaces: [
                { type: 'datatable', dataSource: 'workspaceActions' },
                { type: 'datatable', dataSource: 'workspaceActions' },
              ],
            }
          : node,
      ),
    };
    const result = normalizeWorkflow(twins as typeof document);
    const issue = result.issues.find((candidate) => candidate.rule === 'id.ambiguous');
    expect(issue?.severity).toBe('error');
    expect(issue?.suggestion).toContain('explicit `id`');
  });

  it('reports ambiguity through validateWorkflow as a blocking error', () => {
    const document = fixtureJson('workspace-onboarding') as Record<string, any>;
    document['nodes'][2].surfaces = [
      { type: 'datatable', dataSource: 'workspaceActions' },
      { type: 'datatable', dataSource: 'workspaceActions' },
      { type: 'link', target: 'action-two', when: 'canRunActionTwo' },
      { type: 'link', target: 'action-three' },
    ];
    document['requires'].dataSources = ['workspaceActions'];
    const result = validateWorkflow(document);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.rule)).toContain('id.ambiguous');
  });
});

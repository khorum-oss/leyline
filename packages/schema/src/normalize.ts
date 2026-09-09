import { deterministicId } from './ids.js';
import { pointer, type Issue } from './issues.js';
import type { WorkflowDocument } from './workflow.js';
import type { Surface } from './surface.js';
import type { EventTransition, Transition } from './transition.js';

/**
 * Filling in the identifiers an author left out (AD12).
 *
 * Two rules make the result usable rather than merely deterministic:
 *
 * - **Position never contributes.** Reordering a node's surfaces leaves every
 *   identifier untouched, so an agent that discovered one in a previous call
 *   can still rely on it.
 * - **Only identity contributes, never presentation.** A surface's type and the
 *   data it draws on identify it; its guard and its props do not. Attaching a
 *   guard to a surface therefore keeps the surface addressable under the same
 *   identifier, which is exactly what the §2 agent scenario needs.
 *
 * Where those fields fail to separate two siblings, the document is ambiguous
 * and the author must supply an explicit identifier. Guessing would produce an
 * identifier that silently moves later.
 */

export interface NormalizeResult {
  readonly document: WorkflowDocument;
  readonly issues: readonly Issue[];
}

function surfaceIdentity(workflowId: string, nodeId: string, surface: Surface): string[] {
  return [
    'surface',
    workflowId,
    nodeId,
    surface.type,
    surface.dataSource ?? '',
    surface.target ?? '',
  ];
}

function transitionIdentity(
  workflowId: string,
  nodeId: string,
  bucket: string,
  transition: Transition & { on?: string },
): string[] {
  return ['transition', workflowId, nodeId, bucket, transition.on ?? '', transition.target];
}

function ambiguous(path: string, id: string, what: string): Issue {
  return {
    severity: 'error',
    rule: 'id.ambiguous',
    path,
    identifier: id,
    message: `Two ${what} in the same node share every identifying field, so no stable identifier separates them.`,
    suggestion: 'Give at least one of them an explicit `id`.',
  };
}

/**
 * Returns the document with every surface and transition carrying an
 * identifier, plus any ambiguity the derivation could not resolve.
 */
export function normalizeWorkflow(document: WorkflowDocument): NormalizeResult {
  const issues: Issue[] = [];
  const seen = new Set<string>();

  const claim = (id: string, path: string, what: string): string => {
    if (seen.has(id)) issues.push(ambiguous(path, id, what));
    seen.add(id);
    return id;
  };

  const nodes = document.nodes.map((node, nodeIndex) => {
    const nodePath = pointer('nodes', nodeIndex);

    const surfaces = node.surfaces?.map((surface, index): Surface => {
      if (surface.id !== undefined) {
        seen.add(surface.id);
        return surface;
      }
      const path = `${nodePath}${pointer('surfaces', index)}`;
      const derived = deterministicId(
        'surface',
        ...surfaceIdentity(document.id, node.id, surface).slice(1),
      );
      return { ...surface, id: claim(derived, path, 'surfaces') };
    });

    const withIds = <T extends Transition & { on?: string }>(
      list: readonly T[] | undefined,
      bucket: string,
    ): T[] | undefined =>
      list?.map((transition, index): T => {
        if (transition.id !== undefined) {
          seen.add(transition.id);
          return transition;
        }
        const path = `${nodePath}${bucket === 'on' ? pointer('on', index) : pointer('invoke', bucket, index)}`;
        const derived = deterministicId(
          'transition',
          ...transitionIdentity(document.id, node.id, bucket, transition).slice(1),
        );
        return { ...transition, id: claim(derived, path, 'transitions') };
      });

    const invoke = node.invoke
      ? {
          ...node.invoke,
          ...(node.invoke.onDone ? { onDone: withIds(node.invoke.onDone, 'onDone') } : {}),
          ...(node.invoke.onError ? { onError: withIds(node.invoke.onError, 'onError') } : {}),
        }
      : undefined;

    return {
      ...node,
      ...(surfaces ? { surfaces } : {}),
      ...(invoke ? { invoke } : {}),
      ...(node.on ? { on: withIds(node.on, 'on') as EventTransition[] } : {}),
    };
  });

  return { document: { ...document, nodes }, issues };
}

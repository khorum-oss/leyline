import type { WorkflowInstance } from '@leyline/core';

/**
 * Introspection that reads like documentation (brief §6).
 *
 * The point is that an agent with no access to application source can find "the
 * table of available actions on the workspace hub" and know what it may do with
 * it. That means descriptions travel alongside identifiers, and the catalogue
 * travels too — a change may name a published renderer and nothing else (I3), so
 * an agent that cannot see the catalogue is reduced to guessing at names it is
 * not allowed to invent.
 */

export interface Introspection {
  readonly workflow: { readonly id: string; readonly name: string; readonly description?: string };
  readonly node: string;
  readonly status: string;
  readonly nodes: readonly { readonly id: string; readonly description?: string }[];
  readonly surfaces: readonly {
    readonly id: string;
    readonly nodeId: string;
    readonly type: string;
    readonly description?: string;
    readonly renderer?: string;
    readonly active: boolean;
  }[];
  readonly registries: readonly {
    readonly id: string;
    readonly entries: number;
    readonly catalogue: readonly {
      readonly id: string;
      readonly description?: string;
      readonly claims: readonly string[];
    }[];
  }[];
  readonly capabilities: readonly { readonly kind: string; readonly name: string }[];
  readonly changeKinds: readonly string[];
  readonly pending: number;
  readonly applied: number;
}

const CHANGE_KINDS = [
  'renderer.register',
  'renderer.unregister',
  'surface.attach-guard',
  'surface.detach-guard',
  'section.reorder-children',
  'section.move-child',
  'workflow.replace',
  'context.patch',
  'change.revert',
] as const;

export function introspect<TContext extends Record<string, unknown>>(
  workflow: WorkflowInstance<TContext>,
): Introspection {
  const described = workflow.control.describe();
  const snapshot = workflow.getSnapshot();

  // Which surfaces are on screen right now, as distinct from which the document
  // defines. An agent asked to change what a user is looking at needs the
  // difference, and a guarded surface that is currently absent is exactly the
  // case where it matters.
  const active = new Set<string>();
  const walk = (region: typeof snapshot.root): void => {
    for (const surface of region.surfaces) active.add(surface.id);
    for (const child of region.children) walk(child);
  };
  walk(snapshot.root);

  return {
    workflow: described.workflow,
    node: snapshot.root.id,
    status: snapshot.status,
    nodes: described.nodes,
    surfaces: described.surfaces.map((surface) => ({
      ...surface,
      active: active.has(surface.id),
    })),
    registries: described.registries,
    capabilities: described.capabilities,
    changeKinds: [...CHANGE_KINDS],
    pending: workflow.control.pending().length,
    applied: workflow.control.log().length,
  };
}

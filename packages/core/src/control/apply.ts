import {
  matchesFieldType,
  pointer,
  validateWorkflow,
  type Change,
  type Issue,
  type JsonValue,
  type WorkflowDocument,
  type WorkflowNode,
} from '@leyline/schema';
import type { RegistryEntry, RendererRegistry } from '../registry.js';

/**
 * Validating and applying one change (AD11).
 *
 * Every change is checked against current state before it commits, and the
 * check returns structured issues rather than a boolean, so an agent can act on
 * the answer (brief §8).
 *
 * Changes are also classified by what they disturb. A change that only alters
 * how the current state is presented applies live — the next snapshot resolves
 * differently and nothing restarts. A change that alters the state graph needs
 * the interpreter rebuilt, and the record says so rather than leaving a caller
 * to notice (decision 0025).
 */

export type ChangeImpact = 'registry' | 'presentation' | 'context' | 'graph';

export interface ControlState {
  readonly document: WorkflowDocument;
  readonly registryEntries: readonly RegistryEntry[];
  /** Values written into context by `context.patch`, kept inert (I4). */
  readonly contextPatch: Readonly<Record<string, JsonValue>>;
}

export interface ChangeOutcome {
  readonly state: ControlState;
  readonly impact: ChangeImpact;
}

const IMPACT: Record<Change['kind'], ChangeImpact> = {
  'renderer.register': 'registry',
  'renderer.unregister': 'registry',
  'surface.attach-guard': 'presentation',
  'surface.detach-guard': 'presentation',
  'section.reorder-children': 'presentation',
  'section.move-child': 'graph',
  'workflow.replace': 'graph',
  'context.patch': 'context',
  'change.revert': 'graph',
};

export function impactOf(change: Change): ChangeImpact {
  return IMPACT[change.kind];
}

function issue(rule: string, message: string, extra: Partial<Issue> = {}): Issue {
  return { severity: 'error', rule, message, ...extra };
}

const nodeIn = (document: WorkflowDocument, id: string): WorkflowNode | undefined =>
  document.nodes.find((node) => node.id === id);

const surfaceIn = (node: WorkflowNode | undefined, id: string) =>
  node?.surfaces?.find((surface) => surface.id === id);

/** Checks a change against current state, returning every reason it cannot apply. */
export function validateChange(
  change: Change,
  state: ControlState,
  registry: RendererRegistry,
): Issue[] {
  const issues: Issue[] = [];
  const { document } = state;

  switch (change.kind) {
    case 'renderer.register': {
      if (change.registry !== registry.id) {
        issues.push(
          issue('registry.unknown', `No registry "${change.registry}" is attached.`, {
            identifier: change.registry,
            path: pointer('registry'),
            suggestion: `This instance has one registry, "${registry.id}".`,
          }),
        );
        break;
      }
      // I3: an initiator may name a renderer the application published, never
      // supply one. A name outside the catalogue simply does not exist.
      if (!registry.knows(change.renderer)) {
        issues.push(
          issue(
            'renderer.undiscoverable',
            `No renderer "${change.renderer}" is in this application's catalogue.`,
            {
              identifier: change.renderer,
              path: pointer('renderer'),
              suggestion: `Choose one of: ${registry
                .catalogue()
                .map((entry) => entry.id)
                .join(', ')}.`,
            },
          ),
        );
        break;
      }
      const type = change.match.surfaceType;
      if (type !== undefined && !registry.claims(change.renderer, type)) {
        issues.push(
          issue(
            'renderer.does-not-claim',
            `"${change.renderer}" does not draw "${type}" surfaces.`,
            {
              identifier: change.renderer,
              path: pointer('match', 'surfaceType'),
              suggestion: `It claims: ${
                registry
                  .catalogue()
                  .find((entry) => entry.id === change.renderer)
                  ?.claims.join(', ') ?? 'nothing'
              }.`,
            },
          ),
        );
      }
      break;
    }

    case 'renderer.unregister': {
      if (!state.registryEntries.some((entry) => entry.id === change.entry)) {
        issues.push(
          issue('registry.unknown-entry', `No entry "${change.entry}" is registered.`, {
            identifier: change.entry,
            path: pointer('entry'),
          }),
        );
      }
      break;
    }

    case 'surface.attach-guard':
    case 'surface.detach-guard': {
      const node = nodeIn(document, change.node);
      if (node === undefined) {
        issues.push(
          issue('graph.dangling-target', `No node "${change.node}" exists.`, {
            identifier: change.node,
            path: pointer('node'),
          }),
        );
        break;
      }
      if (surfaceIn(node, change.surface) === undefined) {
        issues.push(
          issue(
            'surface.unknown',
            `The node "${change.node}" presents no surface "${change.surface}".`,
            { identifier: change.surface, path: pointer('surface') },
          ),
        );
        break;
      }
      if (change.kind === 'surface.attach-guard') {
        // I2: a change may reference a declared guard and can never introduce one.
        const declared = document.requires?.guards ?? [];
        if (!declared.includes(change.guard)) {
          issues.push(
            issue(
              'capability.undeclared',
              `The guard "${change.guard}" is not declared by this workflow.`,
              {
                identifier: change.guard,
                path: pointer('guard'),
                suggestion: `Declared guards: ${declared.join(', ') || 'none'}.`,
              },
            ),
          );
        }
      }
      break;
    }

    case 'section.reorder-children': {
      const node = nodeIn(document, change.node);
      const existing = node?.children ?? [];
      if (node === undefined || node.kind !== 'section') {
        issues.push(
          issue('section.unknown', `No section "${change.node}" exists.`, {
            identifier: change.node,
            path: pointer('node'),
          }),
        );
        break;
      }
      const same =
        existing.length === change.children.length &&
        [...existing].sort().join('|') === [...change.children].sort().join('|');
      if (!same) {
        issues.push(
          issue(
            'section.not-a-permutation',
            'Reordering may change the order of a section’s children, never the set of them.',
            {
              identifier: change.node,
              path: pointer('children'),
              suggestion: `Send exactly these, in the order you want: ${existing.join(', ')}.`,
            },
          ),
        );
      }
      break;
    }

    case 'section.move-child': {
      for (const [field, id] of [
        ['from', change.from],
        ['to', change.to],
      ] as const) {
        const node = nodeIn(document, id);
        if (node === undefined || node.kind !== 'section') {
          issues.push(
            issue('section.unknown', `No section "${id}" exists.`, {
              identifier: id,
              path: pointer(field),
            }),
          );
        }
      }
      const from = nodeIn(document, change.from);
      if (from !== undefined && !(from.children ?? []).includes(change.child)) {
        issues.push(
          issue('section.not-a-child', `"${change.child}" is not a child of "${change.from}".`, {
            identifier: change.child,
            path: pointer('child'),
          }),
        );
      }
      break;
    }

    case 'context.patch': {
      const shape = document.context ?? {};
      for (const [key, value] of Object.entries(change.values)) {
        const field = shape[key];
        if (field === undefined) {
          issues.push(
            issue('context.unknown-field', `The context declares no field "${key}".`, {
              identifier: key,
              path: pointer('values', key),
              suggestion: `Declared fields: ${Object.keys(shape).join(', ') || 'none'}.`,
            }),
          );
          continue;
        }
        // I4: a written value is checked against the declared type and stays
        // inert. Nothing reads it as an identifier, a path, or code.
        if (!matchesFieldType(field.type, value)) {
          issues.push(
            issue(
              'context.type-mismatch',
              `"${key}" is declared ${field.type}, but the value is ${Array.isArray(value) ? 'array' : typeof value}.`,
              { identifier: key, path: pointer('values', key) },
            ),
          );
        }
      }
      break;
    }

    case 'workflow.replace':
    case 'change.revert':
      break;
  }

  if (issues.length > 0) return issues;

  // Document-shaped changes are checked by validating the result. A move that
  // creates a containment cycle, or a replacement with a dangling target, fails
  // here rather than reaching the interpreter.
  const impact = impactOf(change);
  if (impact === 'graph' || impact === 'presentation') {
    const next = applyChange(change, state, registry);
    if (next.state.document !== document) {
      const result = validateWorkflow(next.state.document);
      issues.push(...result.issues.filter((candidate) => candidate.severity === 'error'));
    }
  }

  return issues;
}

function withNodes(
  document: WorkflowDocument,
  update: (node: WorkflowNode) => WorkflowNode,
): WorkflowDocument {
  return { ...document, nodes: document.nodes.map(update) };
}

/** Commits a validated change, producing new state. Never mutates in place. */
export function applyChange(
  change: Change,
  state: ControlState,
  registry: RendererRegistry,
): ChangeOutcome {
  const impact = impactOf(change);
  const { document } = state;

  switch (change.kind) {
    case 'renderer.register': {
      const entry: RegistryEntry = {
        id: registry.entryIdFor(change.renderer, change.match, change.rank),
        renderer: change.renderer,
        match: change.match,
        rank: change.rank,
      };
      return {
        impact,
        state: {
          ...state,
          registryEntries: [
            ...state.registryEntries.filter((existing) => existing.id !== entry.id),
            entry,
          ],
        },
      };
    }

    case 'renderer.unregister':
      return {
        impact,
        state: {
          ...state,
          registryEntries: state.registryEntries.filter((entry) => entry.id !== change.entry),
        },
      };

    case 'surface.attach-guard':
    case 'surface.detach-guard':
      return {
        impact,
        state: {
          ...state,
          document: withNodes(document, (node) =>
            node.id !== change.node
              ? node
              : {
                  ...node,
                  surfaces: node.surfaces?.map((surface) => {
                    if (surface.id !== change.surface) return surface;
                    if (change.kind === 'surface.detach-guard') {
                      const { when: _dropped, ...rest } = surface;
                      return rest;
                    }
                    return { ...surface, when: change.guard };
                  }),
                },
          ),
        },
      };

    case 'section.reorder-children':
      return {
        impact,
        state: {
          ...state,
          document: withNodes(document, (node) =>
            node.id === change.node ? { ...node, children: [...change.children] } : node,
          ),
        },
      };

    case 'section.move-child':
      return {
        impact,
        state: {
          ...state,
          document: withNodes(document, (node) => {
            if (node.id === change.from) {
              return {
                ...node,
                children: (node.children ?? []).filter((id) => id !== change.child),
              };
            }
            if (node.id === change.to) {
              const children = [...(node.children ?? [])];
              children.splice(change.index ?? children.length, 0, change.child);
              return { ...node, children };
            }
            return node;
          }),
        },
      };

    case 'workflow.replace':
      return { impact, state: { ...state, document: change.document as WorkflowDocument } };

    case 'context.patch':
      return {
        impact,
        state: { ...state, contextPatch: { ...state.contextPatch, ...change.values } },
      };

    case 'change.revert':
      // Reverting is resolved by replaying the log, so applying the record
      // itself changes nothing here (decision 0026).
      return { impact, state };
  }
}

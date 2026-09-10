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

type Registered = Extract<Change, { kind: 'renderer.register' }>;
type Unregistered = Extract<Change, { kind: 'renderer.unregister' }>;
type GuardChange = Extract<Change, { kind: 'surface.attach-guard' | 'surface.detach-guard' }>;
type Reorder = Extract<Change, { kind: 'section.reorder-children' }>;
type Move = Extract<Change, { kind: 'section.move-child' }>;
type Patch = Extract<Change, { kind: 'context.patch' }>;

function validateRendererRegister(change: Registered, registry: RendererRegistry): Issue[] {
  if (change.registry !== registry.id) {
    return [
      issue('registry.unknown', `No registry "${change.registry}" is attached.`, {
        identifier: change.registry,
        path: pointer('registry'),
        suggestion: `This instance has one registry, "${registry.id}".`,
      }),
    ];
  }

  // I3: an initiator may name a renderer the application published, never
  // supply one. A name outside the catalogue simply does not exist.
  if (!registry.knows(change.renderer)) {
    return [
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
    ];
  }

  // A surface entry names a surface type; a region entry names a node kind.
  // Either way the catalogue decides whether the renderer draws that thing.
  const region = (change.match.target ?? 'surface') === 'region';
  const what = region ? change.match.nodeKind : change.match.surfaceType;
  if (what === undefined || registry.claims(change.renderer, what)) return [];
  return [
    issue(
      'renderer.does-not-claim',
      `"${change.renderer}" does not draw "${what}" ${region ? 'regions' : 'surfaces'}.`,
      {
        identifier: change.renderer,
        path: pointer('match', region ? 'nodeKind' : 'surfaceType'),
        suggestion: `It claims: ${
          registry
            .catalogue()
            .find((entry) => entry.id === change.renderer)
            ?.claims.join(', ') ?? 'nothing'
        }.`,
      },
    ),
  ];
}

function validateRendererUnregister(change: Unregistered, state: ControlState): Issue[] {
  if (state.registryEntries.some((entry) => entry.id === change.entry)) return [];
  return [
    issue('registry.unknown-entry', `No entry "${change.entry}" is registered.`, {
      identifier: change.entry,
      path: pointer('entry'),
    }),
  ];
}

function validateGuardChange(change: GuardChange, document: WorkflowDocument): Issue[] {
  const node = nodeIn(document, change.node);
  if (node === undefined) {
    return [
      issue('graph.dangling-target', `No node "${change.node}" exists.`, {
        identifier: change.node,
        path: pointer('node'),
      }),
    ];
  }
  if (surfaceIn(node, change.surface) === undefined) {
    return [
      issue(
        'surface.unknown',
        `The node "${change.node}" presents no surface "${change.surface}".`,
        {
          identifier: change.surface,
          path: pointer('surface'),
        },
      ),
    ];
  }
  if (change.kind !== 'surface.attach-guard') return [];

  // I2: a change may reference a declared guard and can never introduce one.
  const declared = document.requires?.guards ?? [];
  if (declared.includes(change.guard)) return [];
  return [
    issue(
      'capability.undeclared',
      `The guard "${change.guard}" is not declared by this workflow.`,
      {
        identifier: change.guard,
        path: pointer('guard'),
        suggestion: `Declared guards: ${declared.join(', ') || 'none'}.`,
      },
    ),
  ];
}

function validateReorder(change: Reorder, document: WorkflowDocument): Issue[] {
  const node = nodeIn(document, change.node);
  if (node?.kind !== 'section') {
    return [
      issue('section.unknown', `No section "${change.node}" exists.`, {
        identifier: change.node,
        path: pointer('node'),
      }),
    ];
  }

  // A set comparison rather than sorting both sides and comparing strings: it
  // says what it means, it costs one pass, and it catches a repeated child
  // rather than relying on a default sort to expose it.
  const existing = node.children ?? [];
  const wanted = new Set(change.children);
  const same =
    wanted.size === change.children.length &&
    existing.length === change.children.length &&
    existing.every((id) => wanted.has(id));
  if (same) return [];

  return [
    issue(
      'section.not-a-permutation',
      'Reordering may change the order of a section\u2019s children, never the set of them.',
      {
        identifier: change.node,
        path: pointer('children'),
        suggestion: `Send exactly these, in the order you want: ${existing.join(', ')}.`,
      },
    ),
  ];
}

function validateMove(change: Move, document: WorkflowDocument): Issue[] {
  const issues: Issue[] = [];
  for (const [field, id] of [
    ['from', change.from],
    ['to', change.to],
  ] as const) {
    const node = nodeIn(document, id);
    if (node?.kind !== 'section') {
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
  return issues;
}

function validatePatch(change: Patch, document: WorkflowDocument): Issue[] {
  const shape = document.context ?? {};
  return Object.entries(change.values).flatMap(([key, value]): Issue[] => {
    const field = shape[key];
    if (field === undefined) {
      return [
        issue('context.unknown-field', `The context declares no field "${key}".`, {
          identifier: key,
          path: pointer('values', key),
          suggestion: `Declared fields: ${Object.keys(shape).join(', ') || 'none'}.`,
        }),
      ];
    }
    // I4: a written value is checked against the declared type and stays inert.
    // Nothing reads it as an identifier, a path, or code.
    if (matchesFieldType(field.type, value)) return [];
    return [
      issue(
        'context.type-mismatch',
        `"${key}" is declared ${field.type}, but the value is ${Array.isArray(value) ? 'array' : typeof value}.`,
        { identifier: key, path: pointer('values', key) },
      ),
    ];
  });
}

/** Dispatches to the validator for one change kind. */
function checkChange(change: Change, state: ControlState, registry: RendererRegistry): Issue[] {
  switch (change.kind) {
    case 'renderer.register':
      return validateRendererRegister(change, registry);
    case 'renderer.unregister':
      return validateRendererUnregister(change, state);
    case 'surface.attach-guard':
    case 'surface.detach-guard':
      return validateGuardChange(change, state.document);
    case 'section.reorder-children':
      return validateReorder(change, state.document);
    case 'section.move-child':
      return validateMove(change, state.document);
    case 'context.patch':
      return validatePatch(change, state.document);
    case 'workflow.replace':
    case 'change.revert':
      return [];
  }
}

/** Checks a change against current state, returning every reason it cannot apply. */
export function validateChange(
  change: Change,
  state: ControlState,
  registry: RendererRegistry,
): Issue[] {
  const issues = checkChange(change, state, registry);
  if (issues.length > 0) return issues;

  // Document-shaped changes are checked by validating the result. A move that
  // creates a containment cycle, or a replacement with a dangling target, fails
  // here rather than reaching the interpreter.
  const impact = impactOf(change);
  if (impact !== 'graph' && impact !== 'presentation') return issues;

  const next = applyChange(change, state, registry);
  if (next.state.document === state.document) return issues;
  return validateWorkflow(next.state.document).issues.filter(
    (candidate) => candidate.severity === 'error',
  );
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

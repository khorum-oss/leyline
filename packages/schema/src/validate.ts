import { type z } from 'zod';
import { findHygieneIssues } from './hygiene.js';
import { hasErrors, pointer, type Issue, type ValidationResult } from './issues.js';
import { normalizeWorkflow } from './normalize.js';
import { buildContainment, enteredChildren, isPermittedTarget } from './containment.js';
import { isNodeKind, isSurfaceType } from './vocabulary.js';
import { SURFACE_KEYS } from './surface.js';
import { NODE_KEYS } from './node.js';
import { EVENT_TRANSITION_KEYS, INVOKE_KEYS, TRANSITION_KEYS } from './transition.js';
import {
  REQUIREMENTS_KEYS,
  WORKFLOW_KEYS,
  workflowDocumentSchema,
  type WorkflowDocument,
} from './workflow.js';
import type { Transition } from './transition.js';
import type { WorkflowNode } from './node.js';
import type { Surface } from './surface.js';

/**
 * Graph and capability validation.
 *
 * Three principles shape what counts as an error here:
 *
 * - **Structure is an error; vocabulary is a warning.** A dangling target
 *   breaks the graph. An unrecognised surface type merely means this build
 *   predates the document, which additive evolution requires it to survive
 *   (AD8), so it degrades to a fallback and a warning.
 * - **Every issue names its path and the identifier at fault** (brief §8).
 * - **Nothing here evaluates anything.** Validation reads data and returns
 *   data; it resolves no capability and calls no implementation (I1).
 */

function unknownFields(
  value: object,
  known: readonly string[],
  path: string,
  what: string,
): Issue[] {
  return Object.keys(value)
    .filter((key) => !known.includes(key))
    .map((key) => ({
      severity: 'warning' as const,
      rule: 'document.unknown-field',
      path: `${path}${pointer(key)}`,
      identifier: key,
      message: `"${key}" is not a field this build knows on a ${what}.`,
      suggestion:
        'Check the spelling. A document written against a later minor version keeps the field, and this build ignores it.',
    }));
}

function fromZod(error: z.ZodError): Issue[] {
  return error.issues.map((issue) => ({
    severity: 'error' as const,
    rule: 'document.invalid-field',
    path: pointer(...issue.path.map((segment) => String(segment))),
    message: issue.message,
  }));
}

/**
 * Parses a document without deriving identifiers or walking the graph.
 *
 * Round-tripping goes through here: what comes out serializes back to what went
 * in, byte for byte.
 */
export function parseWorkflow(input: unknown): ValidationResult<WorkflowDocument> {
  const hygiene: Issue[] = findHygieneIssues(input).map((issue) => ({
    severity: 'error',
    rule: 'hygiene.forbidden-key',
    path: issue.path,
    identifier: issue.key,
    message: `"${issue.key}" may not appear as a key anywhere in a document (I7).`,
    suggestion: 'Remove the key. Parsing through parseDocumentJson drops it automatically.',
  }));
  if (hygiene.length > 0) return { ok: false, issues: hygiene };

  const parsed = workflowDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: fromZod(parsed.error) };
  return { ok: true, issues: [], document: parsed.data };
}

/**
 * Parses, checks the graph and the declared capabilities, and derives the
 * identifiers the author left out.
 */
/**
 * What every per-node check needs, gathered once.
 *
 * Passing this around keeps each check small enough to read in one sitting —
 * the alternative is one function that knows the whole document, which is how
 * the graph checks grew past the point where anyone could see them all.
 */
interface Walk {
  readonly document: WorkflowDocument;
  readonly nodeIds: ReadonlySet<string>;
  readonly containment: ReturnType<typeof buildContainment>;
  readonly contextFields: ReadonlySet<string>;
  readonly declared: Record<CapabilityGroup, ReadonlySet<string>>;
  readonly used: Record<CapabilityGroup, Set<string>>;
  readonly edges: Map<string, Set<string>>;
  readonly issues: Issue[];
}

type CapabilityGroup = 'guards' | 'services' | 'dataSources';

const SINGULAR: Record<CapabilityGroup, string> = {
  guards: 'guard',
  services: 'service',
  dataSources: 'data source',
};

function addEdge(walk: Walk, from: string, to: string): void {
  const targets = walk.edges.get(from) ?? new Set<string>();
  targets.add(to);
  walk.edges.set(from, targets);
}

function checkTarget(walk: Walk, target: string, path: string, from: string): void {
  if (!walk.nodeIds.has(target)) {
    walk.issues.push({
      severity: 'error',
      rule: 'graph.dangling-target',
      path,
      identifier: target,
      message: `Nothing in this document defines a node "${target}".`,
      suggestion: 'Point the target at an existing node, or add the node.',
    });
    return;
  }
  if (isPermittedTarget(from, target, walk.containment.parents)) return;

  const parent = walk.containment.parents.get(target) as string;
  walk.issues.push({
    severity: 'error',
    rule: 'graph.cross-boundary-target',
    path,
    identifier: target,
    message: `"${target}" sits inside the section "${parent}", which "${from}" is not part of.`,
    suggestion: `Target "${parent}" instead; entering a section activates its children.`,
  });
}

function checkCapability(walk: Walk, kind: CapabilityGroup, name: string, path: string): void {
  walk.used[kind].add(name);
  if (walk.declared[kind].has(name)) return;
  walk.issues.push({
    severity: 'error',
    rule: 'capability.undeclared',
    path,
    identifier: name,
    message: `The ${SINGULAR[kind]} "${name}" is used but not declared in \`requires\`.`,
    suggestion: `Add "${name}" to requires.${kind}, so binding can verify it up front (I2).`,
  });
}

function checkTransition(walk: Walk, transition: Transition, path: string, from: string): void {
  checkTarget(walk, transition.target, `${path}${pointer('target')}`, from);
  addEdge(walk, from, transition.target);
  if (transition.when !== undefined) {
    checkCapability(walk, 'guards', transition.when, `${path}${pointer('when')}`);
  }
}

function checkSurface(walk: Walk, node: WorkflowNode, surface: Surface, path: string): void {
  walk.issues.push(...unknownFields(surface, SURFACE_KEYS, path, 'surface'));

  if (!isSurfaceType(surface.type)) {
    walk.issues.push({
      severity: 'warning',
      rule: 'vocabulary.unknown-surface-type',
      path: `${path}${pointer('type')}`,
      identifier: surface.type,
      message: `"${surface.type}" is not a surface type this build knows.`,
      suggestion: 'A registry with no renderer for it draws the registered fallback and logs.',
    });
  }

  if (surface.when !== undefined) {
    checkCapability(walk, 'guards', surface.when, `${path}${pointer('when')}`);
  }
  if (surface.dataSource !== undefined) {
    checkCapability(walk, 'dataSources', surface.dataSource, `${path}${pointer('dataSource')}`);
  }

  if (surface.target !== undefined) {
    checkTarget(walk, surface.target, `${path}${pointer('target')}`, node.id);
    addEdge(walk, node.id, surface.target);
    return;
  }
  if (surface.type !== 'link') return;

  walk.issues.push({
    severity: 'error',
    rule: 'surface.missing-target',
    path,
    identifier: surface.id ?? surface.type,
    message: 'A `link` surface navigates somewhere, so it needs a `target`.',
    suggestion: 'Add `target` naming the node this link leads to.',
  });
}

function checkInvoke(walk: Walk, node: WorkflowNode, nodePath: string): void {
  if (!node.invoke) return;
  const path = `${nodePath}${pointer('invoke')}`;
  walk.issues.push(...unknownFields(node.invoke, INVOKE_KEYS, path, 'service invocation'));
  checkCapability(walk, 'services', node.invoke.service, `${path}${pointer('service')}`);

  const assignTo = node.invoke.assignTo;
  if (assignTo !== undefined && !walk.contextFields.has(assignTo)) {
    walk.issues.push({
      severity: 'error',
      rule: 'context.unknown-field',
      path: `${path}${pointer('assignTo')}`,
      identifier: assignTo,
      message: `The context declares no field "${assignTo}" to assign the result to.`,
      suggestion: `Declare "${assignTo}" in \`context\`, so a written value can be checked against a type (I4).`,
    });
  }

  for (const bucket of ['onDone', 'onError'] as const) {
    for (const [index, transition] of (node.invoke[bucket] ?? []).entries()) {
      const transitionPath = `${path}${pointer(bucket, index)}`;
      walk.issues.push(...unknownFields(transition, TRANSITION_KEYS, transitionPath, 'transition'));
      checkTransition(walk, transition, transitionPath, node.id);
    }
  }
}

function checkNode(walk: Walk, node: WorkflowNode, index: number): void {
  const path = pointer('nodes', index);
  walk.issues.push(...unknownFields(node, NODE_KEYS, path, 'node'));

  if (!isNodeKind(node.kind)) {
    walk.issues.push({
      severity: 'warning',
      rule: 'vocabulary.unknown-node-kind',
      path: `${path}${pointer('kind')}`,
      identifier: node.kind,
      message: `"${node.kind}" is not a node kind this build knows.`,
      suggestion: 'A consumer that does not recognise the kind falls back rather than failing.',
    });
  }

  for (const [surfaceIndex, surface] of (node.surfaces ?? []).entries()) {
    checkSurface(walk, node, surface, `${path}${pointer('surfaces', surfaceIndex)}`);
  }

  checkInvoke(walk, node, path);

  for (const [index_, transition] of (node.on ?? []).entries()) {
    const transitionPath = `${path}${pointer('on', index_)}`;
    walk.issues.push(
      ...unknownFields(transition, EVENT_TRANSITION_KEYS, transitionPath, 'transition'),
    );
    checkTransition(walk, transition, transitionPath, node.id);
  }
}

/** Duplicate identifiers, and an entry that names something real and reachable. */
function checkStructure(walk: Walk): void {
  const seen = new Set<string>();
  for (const [index, node] of walk.document.nodes.entries()) {
    if (seen.has(node.id)) {
      walk.issues.push({
        severity: 'error',
        rule: 'graph.duplicate-node',
        path: pointer('nodes', index, 'id'),
        identifier: node.id,
        message: `Two nodes share the identifier "${node.id}".`,
        suggestion: 'Node identifiers address a single position; rename one of them.',
      });
    }
    seen.add(node.id);
  }

  if (!walk.nodeIds.has(walk.document.entry)) {
    walk.issues.push({
      severity: 'error',
      rule: 'graph.unknown-entry',
      path: pointer('entry'),
      identifier: walk.document.entry,
      message: `The entry node "${walk.document.entry}" is not among the document's nodes.`,
      suggestion: `Point \`entry\` at one of: ${[...walk.nodeIds].join(', ')}.`,
    });
    return;
  }

  const parent = walk.containment.parents.get(walk.document.entry);
  if (parent === undefined) return;
  walk.issues.push({
    severity: 'error',
    rule: 'graph.entry-not-root',
    path: pointer('entry'),
    identifier: walk.document.entry,
    message: `The entry node "${walk.document.entry}" sits inside the section "${parent}".`,
    suggestion: 'Enter at the section instead; a section entered activates its children itself.',
  });
}

/**
 * A node is reached by a transition, or by the section holding it becoming
 * active. Entering a section in `many` mode activates every child; in `one`
 * mode it activates the initial child, and transitions reach the siblings.
 */
function checkReachability(walk: Walk): void {
  if (!walk.nodeIds.has(walk.document.entry)) return;

  const nodesById = new Map(walk.document.nodes.map((node) => [node.id, node] as const));
  const reached = new Set<string>([walk.document.entry]);
  const queue = [walk.document.entry];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const node = nodesById.get(current);
    const next = [...(walk.edges.get(current) ?? []), ...(node ? enteredChildren(node) : [])];
    for (const candidate of next) {
      if (reached.has(candidate)) continue;
      reached.add(candidate);
      queue.push(candidate);
    }
  }

  for (const [index, node] of walk.document.nodes.entries()) {
    if (reached.has(node.id)) continue;
    walk.issues.push({
      severity: 'error',
      rule: 'graph.unreachable-node',
      path: pointer('nodes', index),
      identifier: node.id,
      message: `No path leads from the entry node to "${node.id}".`,
      suggestion:
        'Add a transition or a link that reaches it, put it in a section that runs, or remove it. A node nothing reaches is usually a wiring mistake.',
    });
  }
}

function checkUnusedCapabilities(walk: Walk): void {
  for (const kind of ['guards', 'services', 'dataSources'] as const) {
    for (const name of walk.declared[kind]) {
      if (walk.used[kind].has(name)) continue;
      walk.issues.push({
        severity: 'warning',
        rule: 'capability.unused',
        path: pointer('requires', kind),
        identifier: name,
        message: `\`requires\` declares "${name}", which nothing in this document references.`,
        suggestion: 'Remove it, so binding demands only what the workflow actually uses.',
      });
    }
  }
}

/**
 * Parses, checks the graph and the declared capabilities, and derives the
 * identifiers the author left out.
 */
export function validateWorkflow(input: unknown): ValidationResult<WorkflowDocument> {
  const parsed = parseWorkflow(input);
  if (!parsed.document) return parsed;

  const document = parsed.document;
  const nodeIds = new Set(document.nodes.map((node) => node.id));
  const walk: Walk = {
    document,
    nodeIds,
    containment: buildContainment(document, nodeIds),
    contextFields: new Set(Object.keys(document.context ?? {})),
    declared: {
      guards: new Set(document.requires?.guards ?? []),
      services: new Set(document.requires?.services ?? []),
      dataSources: new Set(document.requires?.dataSources ?? []),
    },
    used: { guards: new Set(), services: new Set(), dataSources: new Set() },
    edges: new Map(),
    issues: [...parsed.issues],
  };

  walk.issues.push(...walk.containment.issues);
  checkStructure(walk);

  document.nodes.forEach((node, index) => checkNode(walk, node, index));

  walk.issues.push(...unknownFields(document, WORKFLOW_KEYS, '', 'workflow document'));
  if (document.requires) {
    walk.issues.push(
      ...unknownFields(
        document.requires,
        REQUIREMENTS_KEYS,
        pointer('requires'),
        'requirements block',
      ),
    );
  }

  checkReachability(walk);
  checkUnusedCapabilities(walk);

  const normalized = normalizeWorkflow(document);
  walk.issues.push(...normalized.issues);

  return { ok: !hasErrors(walk.issues), issues: walk.issues, document: normalized.document };
}

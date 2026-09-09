import { type z } from 'zod';
import { findHygieneIssues } from './hygiene.js';
import { hasErrors, pointer, type Issue, type ValidationResult } from './issues.js';
import { normalizeWorkflow } from './normalize.js';
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
export function validateWorkflow(input: unknown): ValidationResult<WorkflowDocument> {
  const parsed = parseWorkflow(input);
  if (!parsed.document) return parsed;

  const document = parsed.document;
  const issues: Issue[] = [...parsed.issues];

  // --- Structure -----------------------------------------------------------

  const nodeIds = new Set<string>();
  for (const [index, node] of document.nodes.entries()) {
    if (nodeIds.has(node.id)) {
      issues.push({
        severity: 'error',
        rule: 'graph.duplicate-node',
        path: pointer('nodes', index, 'id'),
        identifier: node.id,
        message: `Two nodes share the identifier "${node.id}".`,
        suggestion: 'Node identifiers address a single position; rename one of them.',
      });
    }
    nodeIds.add(node.id);
  }

  if (!nodeIds.has(document.entry)) {
    issues.push({
      severity: 'error',
      rule: 'graph.unknown-entry',
      path: pointer('entry'),
      identifier: document.entry,
      message: `The entry node "${document.entry}" is not among the document's nodes.`,
      suggestion: `Point \`entry\` at one of: ${[...nodeIds].join(', ')}.`,
    });
  }

  // --- Edges, capabilities, and context ------------------------------------

  const declared = {
    guards: new Set(document.requires?.guards ?? []),
    services: new Set(document.requires?.services ?? []),
    dataSources: new Set(document.requires?.dataSources ?? []),
  };
  const used = {
    guards: new Set<string>(),
    services: new Set<string>(),
    dataSources: new Set<string>(),
  };
  const contextFields = new Set(Object.keys(document.context ?? {}));
  const edges = new Map<string, Set<string>>();

  const addEdge = (from: string, to: string): void => {
    const targets = edges.get(from) ?? new Set<string>();
    targets.add(to);
    edges.set(from, targets);
  };

  const checkTarget = (target: string, path: string): void => {
    if (nodeIds.has(target)) return;
    issues.push({
      severity: 'error',
      rule: 'graph.dangling-target',
      path,
      identifier: target,
      message: `Nothing in this document defines a node "${target}".`,
      suggestion: 'Point the target at an existing node, or add the node.',
    });
  };

  const checkCapability = (
    kind: 'guards' | 'services' | 'dataSources',
    name: string,
    path: string,
  ): void => {
    used[kind].add(name);
    if (declared[kind].has(name)) return;
    const singular = { guards: 'guard', services: 'service', dataSources: 'data source' }[kind];
    issues.push({
      severity: 'error',
      rule: 'capability.undeclared',
      path,
      identifier: name,
      message: `The ${singular} "${name}" is used but not declared in \`requires\`.`,
      suggestion: `Add "${name}" to requires.${kind}, so binding can verify it up front (I2).`,
    });
  };

  const checkTransition = (transition: Transition, path: string, from: string): void => {
    checkTarget(transition.target, `${path}${pointer('target')}`);
    addEdge(from, transition.target);
    if (transition.when !== undefined) {
      checkCapability('guards', transition.when, `${path}${pointer('when')}`);
    }
  };

  for (const [index, node] of document.nodes.entries()) {
    const nodePath = pointer('nodes', index);
    issues.push(...unknownFields(node, NODE_KEYS, nodePath, 'node'));

    if (!isNodeKind(node.kind)) {
      issues.push({
        severity: 'warning',
        rule: 'vocabulary.unknown-node-kind',
        path: `${nodePath}${pointer('kind')}`,
        identifier: node.kind,
        message: `"${node.kind}" is not a node kind this build knows.`,
        suggestion: 'A consumer that does not recognise the kind falls back rather than failing.',
      });
    }

    for (const [surfaceIndex, surface] of (node.surfaces ?? []).entries()) {
      const surfacePath = `${nodePath}${pointer('surfaces', surfaceIndex)}`;
      issues.push(...unknownFields(surface, SURFACE_KEYS, surfacePath, 'surface'));

      if (!isSurfaceType(surface.type)) {
        issues.push({
          severity: 'warning',
          rule: 'vocabulary.unknown-surface-type',
          path: `${surfacePath}${pointer('type')}`,
          identifier: surface.type,
          message: `"${surface.type}" is not a surface type this build knows.`,
          suggestion: 'A registry with no renderer for it draws the registered fallback and logs.',
        });
      }

      if (surface.when !== undefined) {
        checkCapability('guards', surface.when, `${surfacePath}${pointer('when')}`);
      }
      if (surface.dataSource !== undefined) {
        checkCapability(
          'dataSources',
          surface.dataSource,
          `${surfacePath}${pointer('dataSource')}`,
        );
      }
      if (surface.target !== undefined) {
        checkTarget(surface.target, `${surfacePath}${pointer('target')}`);
        addEdge(node.id, surface.target);
      } else if (surface.type === 'link') {
        issues.push({
          severity: 'error',
          rule: 'surface.missing-target',
          path: surfacePath,
          identifier: surface.id ?? surface.type,
          message: 'A `link` surface navigates somewhere, so it needs a `target`.',
          suggestion: 'Add `target` naming the node this link leads to.',
        });
      }
    }

    if (node.invoke) {
      const invokePath = `${nodePath}${pointer('invoke')}`;
      issues.push(...unknownFields(node.invoke, INVOKE_KEYS, invokePath, 'service invocation'));
      checkCapability('services', node.invoke.service, `${invokePath}${pointer('service')}`);

      if (node.invoke.assignTo !== undefined && !contextFields.has(node.invoke.assignTo)) {
        issues.push({
          severity: 'error',
          rule: 'context.unknown-field',
          path: `${invokePath}${pointer('assignTo')}`,
          identifier: node.invoke.assignTo,
          message: `The context declares no field "${node.invoke.assignTo}" to assign the result to.`,
          suggestion: `Declare "${node.invoke.assignTo}" in \`context\`, so a written value can be checked against a type (I4).`,
        });
      }

      for (const bucket of ['onDone', 'onError'] as const) {
        for (const [i, transition] of (node.invoke[bucket] ?? []).entries()) {
          const path = `${invokePath}${pointer(bucket, i)}`;
          issues.push(...unknownFields(transition, TRANSITION_KEYS, path, 'transition'));
          checkTransition(transition, path, node.id);
        }
      }
    }

    for (const [i, transition] of (node.on ?? []).entries()) {
      const path = `${nodePath}${pointer('on', i)}`;
      issues.push(...unknownFields(transition, EVENT_TRANSITION_KEYS, path, 'transition'));
      checkTransition(transition, path, node.id);
    }
  }

  issues.push(...unknownFields(document, WORKFLOW_KEYS, '', 'workflow document'));
  if (document.requires) {
    issues.push(
      ...unknownFields(
        document.requires,
        REQUIREMENTS_KEYS,
        pointer('requires'),
        'requirements block',
      ),
    );
  }

  // --- Reachability --------------------------------------------------------

  if (nodeIds.has(document.entry)) {
    const reached = new Set<string>([document.entry]);
    const queue = [document.entry];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const next of edges.get(current) ?? []) {
        if (reached.has(next)) continue;
        reached.add(next);
        queue.push(next);
      }
    }

    for (const [index, node] of document.nodes.entries()) {
      if (reached.has(node.id)) continue;
      issues.push({
        severity: 'error',
        rule: 'graph.unreachable-node',
        path: pointer('nodes', index),
        identifier: node.id,
        message: `No path leads from the entry node to "${node.id}".`,
        suggestion:
          'Add a transition or a link that reaches it, or remove it. A node nothing reaches is usually a wiring mistake.',
      });
    }
  }

  // --- Declared but unused -------------------------------------------------

  for (const kind of ['guards', 'services', 'dataSources'] as const) {
    for (const name of declared[kind]) {
      if (used[kind].has(name)) continue;
      issues.push({
        severity: 'warning',
        rule: 'capability.unused',
        path: pointer('requires', kind),
        identifier: name,
        message: `\`requires\` declares "${name}", which nothing in this document references.`,
        suggestion: 'Remove it, so binding demands only what the workflow actually uses.',
      });
    }
  }

  const normalized = normalizeWorkflow(document);
  issues.push(...normalized.issues);

  return { ok: !hasErrors(issues), issues, document: normalized.document };
}

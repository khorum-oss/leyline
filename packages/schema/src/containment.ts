import { pointer, type Issue } from './issues.js';
import type { WorkflowDocument, WorkflowNode } from './index.js';

/**
 * Containment: which nodes a `section` holds, and what that permits
 * (decision 0019).
 *
 * A section names its children rather than nesting them, so the `nodes` array
 * stays flat and a transition target stays a plain identifier. The tree exists
 * as a derived structure — built here, checked here, and used by reachability
 * and by the interpreter.
 */

export interface Containment {
  /** Child identifier to the identifier of the section holding it. */
  readonly parents: ReadonlyMap<string, string>;
  /** Nodes no section holds. A workflow enters at one of these. */
  readonly roots: readonly string[];
  readonly issues: readonly Issue[];
}

function ancestorsOf(id: string, parents: ReadonlyMap<string, string>): string[] {
  const chain: string[] = [];
  let current = parents.get(id);
  while (current !== undefined && !chain.includes(current)) {
    chain.push(current);
    current = parents.get(current);
  }
  return chain;
}

/** Builds the containment tree and reports every way it can be malformed. */
export function buildContainment(
  document: WorkflowDocument,
  nodeIds: ReadonlySet<string>,
): Containment {
  const issues: Issue[] = [];
  const parents = new Map<string, string>();
  document.nodes.forEach((node, index) => {
    const path = pointer('nodes', index);
    const isSection = node.kind === 'section';

    if (!isSection && (node.children ?? node.mode ?? node.initial) !== undefined) {
      issues.push({
        severity: 'warning',
        rule: 'section.stray-containment',
        path,
        identifier: node.id,
        message: `"${node.id}" is a ${node.kind}, so its children, mode, and initial fields mean nothing.`,
        suggestion: 'Make it a `section`, or remove the containment fields.',
      });
      return;
    }
    if (!isSection) return;

    const children = node.children ?? [];
    if (children.length === 0) {
      issues.push({
        severity: 'warning',
        rule: 'section.empty',
        path,
        identifier: node.id,
        message: `The section "${node.id}" contains nothing.`,
        suggestion: 'List the nodes it holds in `children`, or use a different node kind.',
      });
    }

    children.forEach((childId, childIndex) => {
      const childPath = `${path}${pointer('children', childIndex)}`;
      if (!nodeIds.has(childId)) {
        issues.push({
          severity: 'error',
          rule: 'graph.unknown-child',
          path: childPath,
          identifier: childId,
          message: `The section "${node.id}" names a child "${childId}" that no node defines.`,
          suggestion: 'Point it at an existing node, or add the node.',
        });
        return;
      }
      const existing = parents.get(childId);
      if (existing !== undefined) {
        issues.push({
          severity: 'error',
          rule: 'graph.multiple-parents',
          path: childPath,
          identifier: childId,
          message: `"${childId}" is already a child of "${existing}". A node belongs to one section.`,
          suggestion: `Remove it from one of the two sections, or give the second section its own node.`,
        });
        return;
      }
      parents.set(childId, node.id);
    });
  });

  // Cycles are checked after the whole map exists, so the report names the
  // section the author is most likely looking at rather than an arbitrary one.
  for (const node of document.nodes) {
    if (node.kind !== 'section') continue;
    const chain = ancestorsOf(node.id, parents);
    if (!chain.includes(node.id)) continue;
    const index = document.nodes.indexOf(node);
    issues.push({
      severity: 'error',
      rule: 'graph.containment-cycle',
      path: pointer('nodes', index),
      identifier: node.id,
      message: `The section "${node.id}" contains itself, through ${chain.join(' → ')}.`,
      suggestion: 'Break the loop. A section holds what is inside it, never itself.',
    });
  }

  document.nodes.forEach((node, index) => {
    if (node.kind !== 'section') return;
    const path = pointer('nodes', index);
    const children = node.children ?? [];
    const mode = node.mode ?? 'one';

    if (mode === 'one' && children.length > 0) {
      if (node.initial === undefined) {
        issues.push({
          severity: 'error',
          rule: 'section.missing-initial',
          path,
          identifier: node.id,
          message: `The section "${node.id}" runs one child at a time but does not say which one starts.`,
          suggestion: `Set \`initial\` to one of: ${children.join(', ')}.`,
        });
      } else if (!children.includes(node.initial)) {
        issues.push({
          severity: 'error',
          rule: 'section.missing-initial',
          path: `${path}${pointer('initial')}`,
          identifier: node.initial,
          message: `"${node.initial}" is not among the children of "${node.id}".`,
          suggestion: `Set \`initial\` to one of: ${children.join(', ')}.`,
        });
      }
    }

    if (mode === 'many' && node.initial !== undefined) {
      issues.push({
        severity: 'warning',
        rule: 'section.mode-mismatch',
        path: `${path}${pointer('initial')}`,
        identifier: node.id,
        message: `"${node.id}" runs every child at once, so \`initial\` has no effect.`,
        suggestion: 'Remove `initial`, or set `mode` to "one".',
      });
    }
  });

  const roots = document.nodes.map((node) => node.id).filter((id) => !parents.has(id));
  return { parents, roots, issues };
}

/**
 * Whether a node may transition to a target.
 *
 * A transition may reach a root node, a sibling, or an ancestor. It may not
 * reach into the interior of a section it does not belong to: entering a
 * container means entering it at the top, and letting a transition land
 * anywhere inside a foreign section is how a state graph becomes unreadable and
 * an interpreter becomes a research project.
 */
export function isPermittedTarget(
  from: string,
  target: string,
  parents: ReadonlyMap<string, string>,
): boolean {
  if (!parents.has(target)) return true;
  if (parents.get(target) === parents.get(from)) return true;
  return ancestorsOf(from, parents).includes(target);
}

/** The children a section activates on entry, given its mode. */
export function enteredChildren(node: WorkflowNode): readonly string[] {
  if (node.kind !== 'section') return [];
  const children = node.children ?? [];
  if ((node.mode ?? 'one') === 'many') return children;
  return node.initial !== undefined && children.includes(node.initial) ? [node.initial] : [];
}

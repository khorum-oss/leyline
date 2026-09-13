import {
  SCHEMA_VERSION,
  parseWorkflow,
  validateWorkflow,
  type WorkflowDocument,
} from '@leyline/schema';
import type { ContextFieldSpec, NodeSpec } from './types.js';

/**
 * The TypeScript builder (G3, AD1).
 *
 * It emits the canonical document and nothing else. The DSL is a convenience
 * layer over the schema, not a second source of truth: hand-written JSON, an
 * agent's output, and this builder are the same artifact by the time anything
 * runs.
 *
 * What it adds is the compile-time half. Nodes are keyed by identifier, so the
 * keys become the union every transition target, entry, and section child is
 * checked against; `requires` becomes the union every guard, service, and data
 * source is checked against; `context` becomes the union `assignTo` is checked
 * against. None of that survives into the output — it exists only while you are
 * typing.
 */

export class WorkflowDefinitionError extends Error {
  readonly issues: ReturnType<typeof validateWorkflow>['issues'];

  constructor(issues: ReturnType<typeof validateWorkflow>['issues']) {
    const errors = issues.filter((issue) => issue.severity === 'error');
    super(
      `The workflow does not validate:\n${errors
        .map((issue) => `  ${issue.rule} at ${issue.path ?? '/'}: ${issue.message}`)
        .join('\n')}`,
    );
    this.name = 'WorkflowDefinitionError';
    this.issues = issues;
  }
}

export interface WorkflowInput<
  TContext extends Record<string, ContextFieldSpec>,
  TGuards extends readonly string[],
  TServices extends readonly string[],
  TSources extends readonly string[],
  TNodes extends Record<string, unknown>,
> {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** Must name one of the nodes below, and must not sit inside a section. */
  readonly entry: Extract<keyof TNodes, string>;
  readonly context?: TContext;
  readonly requires?: {
    readonly guards?: TGuards;
    readonly services?: TServices;
    readonly dataSources?: TSources;
  };
  /**
   * Keyed by identifier rather than an array carrying one.
   *
   * The identifier appears once, and the keys are what every reference in the
   * workflow is checked against.
   */
  readonly nodes: TNodes;
}

/**
 * Builds and validates a workflow document.
 *
 * Types catch what types can: a target that names nothing, a guard nobody
 * declared, a result assigned to a field that does not exist. Everything else —
 * a node no path reaches, a section containing itself, a `link` with no target —
 * is a property of the whole graph, so it is checked here and thrown as
 * `WorkflowDefinitionError` with the same structured issues validation always
 * produces.
 */
export function defineWorkflow<
  const TContext extends Record<string, ContextFieldSpec>,
  const TGuards extends readonly string[],
  const TServices extends readonly string[],
  const TSources extends readonly string[],
  const TNodes extends Record<
    string,
    NodeSpec<
      Extract<keyof TNodes, string>,
      TGuards[number],
      TServices[number],
      TSources[number],
      Extract<keyof TContext, string>
    >
  >,
>(input: WorkflowInput<TContext, TGuards, TServices, TSources, TNodes>): WorkflowDocument {
  const document = {
    leylineVersion: SCHEMA_VERSION,
    id: input.id,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    entry: input.entry,
    ...(input.context !== undefined ? { context: input.context } : {}),
    ...(input.requires !== undefined ? { requires: input.requires } : {}),
    // The key becomes the node's `id`, which is why an author never writes it
    // twice and never has the two disagree.
    nodes: Object.entries(input.nodes).map(([id, node]) => ({
      id,
      ...(node as unknown as Record<string, unknown>),
    })),
  };

  const result = validateWorkflow(document);
  if (!result.ok || result.document === undefined) throw new WorkflowDefinitionError(result.issues);

  // Validation normalizes — it fills in the identifiers an author left out —
  // but what comes back here is the *authored* document, with those left out.
  //
  // A derived identifier is derived (AD12). Baking one into the artifact stores
  // information the document already implies, and makes every stored file churn
  // the day derivation changes. The runtime computes them at load, which is
  // where they belong, and it is why DSL output is byte-identical to what
  // somebody would have typed by hand.
  return parseWorkflow(document).document as WorkflowDocument;
}

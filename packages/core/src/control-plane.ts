import type {
  Change,
  ChangeRecord,
  Initiator,
  Issue,
  PolicyDecision,
  Proposal,
} from '@leyline/schema';

/**
 * The single mutation path over registries and workflows (AD10, AD11, AD13).
 *
 * Application code, a developer at a REPL, devtools, and an AI agent all reach
 * the same interface with the same safety checks. There is no back door.
 */

/**
 * Changes, proposals, records, and policy decisions are defined once in
 * `@leyline/schema` and published as JSON Schema, so a log line, an MCP tool
 * result, and a devtools panel all speak one format. This module re-exports
 * them and adds only what the core itself introduces.
 */
export type { Change, Proposal, ChangeRecord, PolicyDecision, Initiator };

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly Issue[];
}

/** Consulted before validation, apply, and revert alike. Nothing bypasses it (I6). */
export type Policy = (proposal: Proposal) => PolicyDecision | Promise<PolicyDecision>;

/** A self-describing control-plane operation, usable directly as a tool definition (§6). */
export interface OperationDescriptor {
  readonly name: string;
  readonly description: string;
  /** JSON Schema exported from the Zod definitions in `@leyline/schema` (AD9). */
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema: Readonly<Record<string, unknown>>;
}

/**
 * The implementation is the contract.
 *
 * An interface mirroring the `ControlPlane` class would be a second definition
 * free to drift from the first — the duplication this package has already had
 * to collapse twice. Consumers depend on the class; `operations()` describes it
 * as data for anything that cannot.
 */

/** Introspection that reads like documentation, for humans and agents alike. */
export interface Description {
  readonly workflow: { readonly id: string; readonly name: string; readonly description?: string };
  readonly nodes: readonly { readonly id: string; readonly description?: string }[];
  readonly surfaces: readonly {
    readonly id: string;
    readonly nodeId: string;
    readonly type: string;
    readonly description?: string;
    readonly renderer?: string;
  }[];
  readonly registries: readonly { readonly id: string; readonly entries: number }[];
  readonly capabilities: readonly { readonly kind: string; readonly name: string }[];
}

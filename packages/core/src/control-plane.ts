import type { LeylineIssue } from './errors.js';
import type { Initiator } from './contracts.js';

/**
 * The single mutation path over registries and workflows (AD10, AD11, AD13).
 *
 * Application code, a developer at a REPL, devtools, and an AI agent all reach
 * the same interface with the same safety checks. There is no back door.
 */

/** A serializable description of a proposed mutation. Pure data — never code (I1). */
export interface Change {
  readonly kind: string;
  readonly target: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface Proposal {
  readonly id: string;
  readonly change: Change;
  readonly initiator: Initiator;
  readonly correlationId: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly LeylineIssue[];
}

export interface ChangeRecord {
  readonly id: string;
  readonly proposalId: string;
  readonly change: Change;
  readonly initiator: Initiator;
  readonly appliedAt: number;
  readonly revertedBy?: string;
}

export type PolicyDecision =
  | { readonly effect: 'allow' }
  | { readonly effect: 'deny'; readonly reason: string }
  | { readonly effect: 'confirm'; readonly reason: string };

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

export interface ControlPlane {
  describe(): Description;
  propose(change: Change, initiator: Initiator): Promise<Proposal>;
  validate(proposal: Proposal): Promise<ValidationResult>;
  apply(proposal: Proposal): Promise<ChangeRecord>;
  revert(changeId: string): Promise<ChangeRecord>;
  log(): readonly ChangeRecord[];
  operations(): readonly OperationDescriptor[];
}

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

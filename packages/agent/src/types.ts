import type { Attestation, InitiatorKind, Issue } from '@leyline/schema';

/**
 * What a machine consumer sees.
 *
 * `@leyline/agent` adds no capability the control plane lacks (G9). It packages
 * the same operations as self-describing tool definitions, attaches the identity
 * a transport authenticated, and turns every failure into something an agent can
 * act on rather than a stack trace.
 */

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  /** Published JSON Schema, passed to a client verbatim (AD9). */
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema: Readonly<Record<string, unknown>>;
  /** False for operations that only read, so a host can gate writes separately. */
  readonly mutates: boolean;
}

export interface ToolFailure {
  /** Machine-readable, so an agent branches on the code rather than the prose. */
  readonly code: string;
  readonly message: string;
  readonly issues: readonly Issue[];
  /** What to try instead, where that can be said concretely. */
  readonly suggestion?: string;
}

export type ToolResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: ToolFailure };

export interface AgentSurfaceOptions {
  /**
   * Who this surface speaks for. Fixed at construction, never taken from a
   * call, so a caller cannot relabel itself between one tool call and the next.
   */
  readonly initiator?: { readonly kind?: InitiatorKind; readonly label?: string };
  /**
   * What the host authenticated about this connection, if anything.
   *
   * Supplied by whoever accepted the connection. The surface attaches it to
   * every proposal and strips anything a caller tried to send in its place, so
   * an attestation is a fact about the connection rather than a claim in the
   * message (decision 0031).
   */
  readonly attestation?: Attestation;
}

export interface AgentSurface {
  /** Self-describing operations, ready to become tool definitions. */
  tools(): readonly ToolDefinition[];
  /** Runs one operation. Never throws; a failure comes back as data. */
  handle(name: string, input?: unknown): Promise<ToolResult>;
}

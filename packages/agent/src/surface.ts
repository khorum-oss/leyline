import { LeylineError, type WorkflowInstance } from '@leyline/core';
import type { Initiator, Issue } from '@leyline/schema';
import { OPERATIONS, OPERATIONS_BY_NAME } from './operations.js';
import type { AgentSurface, AgentSurfaceOptions, ToolDefinition, ToolResult } from './types.js';

/**
 * The control plane, packaged for a machine consumer.
 *
 * Two things happen here that do not happen anywhere else, and both are about
 * the boundary rather than the operations:
 *
 * - **Identity is fixed at construction.** A caller cannot say who it is; the
 *   surface already knows, because whoever accepted the connection decided.
 * - **Attestation is attached, never accepted.** Anything a caller sends under
 *   `attested` is discarded and replaced with what the host authenticated. An
 *   attestation is a fact about the connection; a caller repeating one back is
 *   just a string (decision 0031).
 */

function failure(
  code: string,
  message: string,
  issues: readonly Issue[] = [],
  suggestion?: string,
): ToolResult {
  return {
    ok: false,
    error: { code, message, issues, ...(suggestion !== undefined ? { suggestion } : {}) },
  };
}

export function createAgentSurface<TContext extends Record<string, unknown>>(
  workflow: WorkflowInstance<TContext>,
  options: AgentSurfaceOptions = {},
): AgentSurface {
  // Built once. Nothing a caller sends can change who it speaks for.
  const initiator: Initiator = {
    kind: options.initiator?.kind ?? 'agent',
    ...(options.initiator?.label !== undefined ? { label: options.initiator.label } : {}),
    ...(options.attestation !== undefined ? { attested: options.attestation } : {}),
  };

  return {
    tools: (): readonly ToolDefinition[] => OPERATIONS.map((operation) => operation.definition),

    async handle(name, input): Promise<ToolResult> {
      const operation = OPERATIONS_BY_NAME.get(name);
      if (operation === undefined) {
        return failure(
          'operation.unknown',
          `No operation named "${name}".`,
          [],
          `Available: ${OPERATIONS.map((candidate) => candidate.definition.name).join(', ')}.`,
        );
      }

      const args =
        input === null || typeof input !== 'object' || Array.isArray(input)
          ? {}
          : ({ ...input } as Record<string, unknown>);

      try {
        const value = await operation.run(
          workflow as unknown as WorkflowInstance<Record<string, unknown>>,
          initiator,
          args,
        );
        return { ok: true, value };
      } catch (error) {
        // Everything reaches an agent as data. A thrown error here would be a
        // transport-level failure, which says nothing about what to try next.
        if (error instanceof LeylineError) {
          return failure(error.code, error.message, error.issues);
        }
        return failure(
          'operation.failed',
          error instanceof Error ? error.message : String(error),
          [],
          'Call leyline_validate on the proposal first; it reports why a change cannot apply.',
        );
      }
    },
  };
}

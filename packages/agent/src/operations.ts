import { exportJsonSchemas, type Initiator } from '@khorum-oss/leyline-schema';
import type { WorkflowInstance } from '@khorum-oss/leyline-core';
import { introspect } from './introspection.js';
import type { ToolDefinition, ToolResult } from './types.js';

/**
 * The operations an agent may perform (AD11, G9).
 *
 * Everything here is the control plane, named and described. Two omissions are
 * deliberate:
 *
 * - **Confirm and cancel are absent.** A policy returning "require
 *   confirmation" is asking somebody other than the initiator to look. An agent
 *   that could confirm its own proposal would make that answer meaningless, so
 *   `pending` is readable and resolving one is not offered here (decision 0027).
 * - **Nothing accepts an initiator.** The surface speaks for one identity, fixed
 *   at construction, so a caller cannot relabel itself between calls.
 */

const schemas = exportJsonSchemas();
const CHANGE_SCHEMA = schemas['leyline-change'] as Record<string, unknown>;
const RECORD_SCHEMA = schemas['leyline-change-record'] as Record<string, unknown>;
const ISSUE_SCHEMA = schemas['leyline-issue'] as Record<string, unknown>;
const TRACE_SCHEMA = schemas['leyline-trace-event'] as Record<string, unknown>;

const NO_INPUT = { type: 'object', properties: {}, additionalProperties: false } as const;

/**
 * A change as sent, whatever the host made of the schema.
 *
 * The declared `type: 'object'` above is the fix; this is the belt to its
 * braces, because a host that stringifies anyway would otherwise get the
 * `context.patch` placeholder back — a valid-looking change that was never the
 * one it sent, which is a worse answer than a refusal.
 */
function asChange(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    // Left as it arrived: propose turns an unparseable change into structured
    // issues, and that is a better answer than an exception thrown from here.
    return value;
  }
}

const byId = (id: string, description: string) => ({
  type: 'object',
  properties: { id: { type: 'string', description } },
  required: ['id'],
  additionalProperties: false,
});

export interface Operation {
  readonly definition: ToolDefinition;
  run(
    workflow: WorkflowInstance<Record<string, unknown>>,
    initiator: Initiator,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}

export const OPERATIONS: readonly Operation[] = [
  {
    definition: {
      name: 'leyline_describe',
      description:
        'Reports the workflow, its nodes, every surface with its description and current renderer, which surfaces are on screen right now, the renderers this application published, and the capabilities the workflow requires. Start here.',
      inputSchema: NO_INPUT,
      outputSchema: { type: 'object' },
      mutates: false,
    },
    run: async (workflow) => introspect(workflow),
  },
  {
    definition: {
      name: 'leyline_propose',
      description:
        'Describes a change and puts it to policy. Nothing is committed. Returns a proposal id to validate and apply.',
      inputSchema: {
        type: 'object',
        // `type` before the spread, not after: the published change schema is a
        // standalone document whose root is a `$ref`, and a host reading this to
        // decide how to encode the argument has nothing else to go on. Without
        // it, Claude Code sends the change as a JSON string.
        properties: { change: { type: 'object', ...CHANGE_SCHEMA } },
        required: ['change'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, correlationId: { type: 'string' } },
      },
      mutates: false,
    },
    run: async (workflow, initiator, input) => {
      const proposal = await workflow.control.propose(asChange(input['change']), initiator);
      return { id: proposal.id, correlationId: proposal.correlationId, change: proposal.change };
    },
  },
  {
    definition: {
      name: 'leyline_validate',
      description:
        'Checks a proposal against current state and returns structured issues. Safe to call as a dry run; call it before applying.',
      inputSchema: byId('id', 'The proposal id returned by leyline_propose.'),
      outputSchema: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, issues: { type: 'array', items: ISSUE_SCHEMA } },
      },
      mutates: false,
    },
    run: async (workflow, _initiator, input) =>
      workflow.control.validate({ id: String(input['id']) } as never),
  },
  {
    definition: {
      name: 'leyline_apply',
      description:
        'Commits a validated proposal and returns its change record. Applying the same proposal twice is a no-op that returns the same record.',
      inputSchema: byId('id', 'The proposal id returned by leyline_propose.'),
      outputSchema: RECORD_SCHEMA,
      mutates: true,
    },
    run: async (workflow, _initiator, input) =>
      workflow.control.apply({ id: String(input['id']) } as never),
  },
  {
    definition: {
      name: 'leyline_revert',
      description:
        'Undoes an applied change by its record id, replaying later changes against the restored state. Fails, with the reason, if a later change would no longer be valid.',
      inputSchema: byId('id', 'The change record id returned by leyline_apply.'),
      outputSchema: RECORD_SCHEMA,
      mutates: true,
    },
    run: async (workflow, initiator, input) =>
      workflow.control.revert(String(input['id']), initiator),
  },
  {
    definition: {
      name: 'leyline_log',
      description: 'The ordered record of applied changes, including what reverted what.',
      inputSchema: NO_INPUT,
      outputSchema: { type: 'array', items: RECORD_SCHEMA },
      mutates: false,
    },
    run: async (workflow) => workflow.control.log(),
  },
  {
    definition: {
      name: 'leyline_pending',
      description:
        'Proposals that policy held for confirmation. Read-only: whoever the application asks to confirm is not the initiator that proposed it.',
      inputSchema: NO_INPUT,
      outputSchema: { type: 'array' },
      mutates: false,
    },
    run: async (workflow) => workflow.control.pending(),
  },
  {
    definition: {
      name: 'leyline_trace',
      description:
        'Recent trace events, newest last. Use it to confirm that an applied change produced the effect you expected.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many events.' },
        },
        additionalProperties: false,
      },
      outputSchema: { type: 'array', items: TRACE_SCHEMA },
      mutates: false,
    },
    run: async (workflow, _initiator, input) => {
      const limit = typeof input['limit'] === 'number' ? input['limit'] : 20;
      return workflow.trace.recent(limit);
    },
  },
];

export const OPERATIONS_BY_NAME: ReadonlyMap<string, Operation> = new Map(
  OPERATIONS.map((operation) => [operation.definition.name, operation] as const),
);

export type { ToolResult };

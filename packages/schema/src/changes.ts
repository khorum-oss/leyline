import { z } from 'zod';
import { capabilityNameSchema, identifierSchema, propsSchema } from './primitives.js';
import { INITIATOR_KINDS } from './vocabulary.js';
import { issueSchema } from './issues.js';
import { workflowDocumentSchema } from './workflow.js';

/**
 * Change descriptions: the serializable vocabulary of the control plane
 * (AD10, AD11).
 *
 * Unlike workflow documents, these objects are strict. A document tolerates
 * unknown fields because a deployed application must survive reading one
 * written against a later version (AD8); a change description travels between
 * two parties in the same conversation, where an unrecognised field means a
 * mistake or an attempt, and silence would serve neither.
 *
 * Every field here is a name or inert data. Nothing carries a function, a
 * component, or an expression (I1, I3).
 */

/**
 * What a transport authenticated, if anything (decision 0031).
 *
 * A caller never supplies this. Whatever sits between an untrusted caller and
 * the control plane — the MCP surface, an HTTP handler — attaches it from the
 * connection it already authenticated, and strips anything the caller tried to
 * put here. Its presence is a fact about the connection, not a claim in the
 * message.
 */
export const attestationSchema = z
  .strictObject({
    /** Who the transport authenticated: a user id, a service account, a key id. */
    subject: z.string().min(1).max(200),
    /** How, in the host's own vocabulary: "oauth", "mtls", "shared-secret". */
    via: z.string().min(1).max(100),
  })
  .meta({ id: 'LeylineAttestation', title: 'Transport attestation' });

export type Attestation = z.infer<typeof attestationSchema>;

export const initiatorSchema = z
  .strictObject({
    kind: z.enum(INITIATOR_KINDS),
    /** Self-asserted and advisory; policy is where anything stronger belongs (OQ7). */
    label: z.string().max(200).optional(),
    /** Filled by the transport, never by the caller. Absent means unauthenticated. */
    attested: attestationSchema.optional(),
  })
  .meta({ id: 'LeylineInitiator', title: 'Initiator' });

export type Initiator = z.infer<typeof initiatorSchema>;

/**
 * What a renderer registration claims. Predicates are data, never code.
 *
 * `target` says whether the entry claims a **surface** or a **region** — the
 * container a `section` node is drawn as. It defaults to `surface`, so every
 * entry written before regions were claimable keeps its meaning (AD8).
 *
 * The discriminator exists because a match naming only `nodeId` already means
 * "every surface on that node", and could not also mean "that node's own
 * container" without becoming ambiguous.
 */
export const rendererMatchSchema = z
  .strictObject({
    target: z.enum(['surface', 'region']).optional(),
    surfaceId: identifierSchema.optional(),
    surfaceType: z.string().min(1).optional(),
    nodeId: identifierSchema.optional(),
    /** Region matches only: claims every node of this kind, e.g. every `section`. */
    nodeKind: z.string().min(1).optional(),
  })
  .refine(
    (match) =>
      match.surfaceId !== undefined ||
      match.surfaceType !== undefined ||
      match.nodeId !== undefined ||
      match.nodeKind !== undefined,
    {
      message: 'a renderer match names at least one of surfaceId, surfaceType, nodeId, or nodeKind',
    },
  )
  .meta({ id: 'LeylineRendererMatch', title: 'Renderer match' });

const registerRenderer = z.strictObject({
  kind: z.literal('renderer.register'),
  registry: identifierSchema,
  /**
   * The renderer to install, named. It must already be discoverable in the
   * application bundle; the control plane cannot accept component code (I3).
   */
  renderer: identifierSchema,
  match: rendererMatchSchema,
  /** Higher ranks win. A specific claim overrides a generic one (AD5). */
  rank: z.number().int().min(0).max(1000),
});

const unregisterRenderer = z.strictObject({
  kind: z.literal('renderer.unregister'),
  registry: identifierSchema,
  entry: identifierSchema,
});

const attachGuard = z.strictObject({
  kind: z.literal('surface.attach-guard'),
  node: identifierSchema,
  surface: identifierSchema,
  /** Must already appear in the bound bundle; a change cannot introduce one (I2). */
  guard: capabilityNameSchema,
});

const detachGuard = z.strictObject({
  kind: z.literal('surface.detach-guard'),
  node: identifierSchema,
  surface: identifierSchema,
});

/**
 * Personalization: the operations an end user performs on their own view
 * (decision 0020).
 *
 * Reordering children changes reading order, which is semantic. Moving a child
 * changes which container holds it. Neither says anything about arrangement —
 * that stays with the renderer the registry resolved, which a user changes
 * through `renderer.register` like anyone else.
 */
const reorderChildren = z.strictObject({
  kind: z.literal('section.reorder-children'),
  node: identifierSchema,
  /** A permutation of the section's existing children. Adding or dropping one is rejected. */
  children: z.array(identifierSchema).min(1),
});

const moveChild = z.strictObject({
  kind: z.literal('section.move-child'),
  child: identifierSchema,
  from: identifierSchema,
  to: identifierSchema,
  /** Where in the destination's reading order to place it. Appended when absent. */
  index: z.number().int().nonnegative().optional(),
});

const replaceWorkflow = z.strictObject({
  kind: z.literal('workflow.replace'),
  document: workflowDocumentSchema,
});

/**
 * Reverting is itself a change (AD10).
 *
 * Giving revert its own kind keeps the promise that there is one mutation path:
 * a revert meets the same policy, produces the same kind of record, and appears
 * in the same log. Reverting a revert therefore needs no special case.
 */
const revertChange = z.strictObject({
  kind: z.literal('change.revert'),
  /** The identifier of the change record being undone. */
  change: identifierSchema,
});

const patchContext = z.strictObject({
  kind: z.literal('context.patch'),
  /** Checked against the workflow's declared context shape, then left inert (I4). */
  values: propsSchema,
});

export const changeSchema = z
  .discriminatedUnion('kind', [
    registerRenderer,
    unregisterRenderer,
    attachGuard,
    detachGuard,
    reorderChildren,
    moveChild,
    replaceWorkflow,
    patchContext,
    revertChange,
  ])
  .meta({
    id: 'LeylineChange',
    title: 'Change',
    description: 'A proposed mutation of a registry or a workflow, as pure data.',
  });

export type Change = z.infer<typeof changeSchema>;

export const CHANGE_KINDS = [
  'renderer.register',
  'renderer.unregister',
  'surface.attach-guard',
  'surface.detach-guard',
  'section.reorder-children',
  'section.move-child',
  'workflow.replace',
  'context.patch',
  'change.revert',
] as const;

export const proposalSchema = z
  .strictObject({
    id: identifierSchema,
    change: changeSchema,
    initiator: initiatorSchema,
    /** Shared by every trace event in this proposal's causal chain (AD15). */
    correlationId: identifierSchema,
  })
  .meta({ id: 'LeylineProposal', title: 'Proposal' });

export type Proposal = z.infer<typeof proposalSchema>;

export const policyDecisionSchema = z
  .discriminatedUnion('effect', [
    z.strictObject({ effect: z.literal('allow') }),
    z.strictObject({ effect: z.literal('deny'), reason: z.string().min(1) }),
    z.strictObject({ effect: z.literal('confirm'), reason: z.string().min(1) }),
  ])
  .meta({ id: 'LeylinePolicyDecision', title: 'Policy decision' });

export type PolicyDecision = z.infer<typeof policyDecisionSchema>;

export const validationOutcomeSchema = z
  .strictObject({ ok: z.boolean(), issues: z.array(issueSchema) })
  .meta({ id: 'LeylineValidationOutcome', title: 'Validation outcome' });

/** Derived from `apply` and `revert` trace events, never maintained beside them (AD15). */
export const changeRecordSchema = z
  .strictObject({
    id: identifierSchema,
    proposalId: identifierSchema,
    change: changeSchema,
    initiator: initiatorSchema,
    appliedAt: z.number().int().nonnegative(),
    revertedBy: identifierSchema.optional(),
  })
  .meta({ id: 'LeylineChangeRecord', title: 'Change record' });

export type ChangeRecord = z.infer<typeof changeRecordSchema>;

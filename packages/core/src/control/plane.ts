import {
  changeSchema,
  deterministicId,
  exportJsonSchemas,
  type Change,
  type ChangeRecord,
  type Initiator,
  type Issue,
  type WorkflowDocument,
} from '@leyline/schema';
import type {
  Description,
  OperationDescriptor,
  Policy,
  PolicyDecision,
  Proposal,
  ValidationResult,
} from '../control-plane.js';
import type { RendererRegistry } from '../registry.js';
import type { TraceEmitter } from '../trace/emitter.js';
import { applyChange, validateChange, type ChangeImpact, type ControlState } from './apply.js';

/**
 * The one mutation path (AD10, AD11).
 *
 * Application code, a developer at a REPL, a devtools panel, and an AI agent
 * all arrive here, and the four phases run the same way for each. There is no
 * privileged route: if application code needs something this cannot express,
 * the fix is a new operation rather than a back door.
 *
 * Policy is consulted at proposal time, before validation, apply, and revert
 * alike, and no operation skips it — including revert, and including changes
 * an application proposes about itself (**I6**).
 */

type ProposalStatus = 'open' | 'pending' | 'denied' | 'applied' | 'cancelled';

/** Where a policy decision leaves a proposal before anyone acts on it. */
function statusFor(decision: PolicyDecision): ProposalStatus {
  if (decision.effect === 'deny') return 'denied';
  if (decision.effect === 'confirm') return 'pending';
  return 'open';
}

/** Why a proposal in this state cannot be applied. */
function blockedBecause(status: ProposalStatus): string {
  if (status === 'pending') return 'awaiting confirmation';
  if (status === 'cancelled') return 'cancelled';
  return 'denied by policy';
}

interface Tracked {
  readonly proposal: Proposal;
  readonly decision: PolicyDecision;
  /** Issues from parsing the change document itself, before anything else ran. */
  readonly parseIssues: readonly Issue[];
  status: ProposalStatus;
  record?: ChangeRecord;
}

export interface ControlPlaneOptions {
  readonly initial: ControlState;
  readonly registry: RendererRegistry;
  readonly policy: Policy;
  readonly emitter: TraceEmitter;
  readonly workflowId: string;
  readonly now?: () => number;
  /** Applied state reaches the runtime here, with what it disturbed. */
  readonly onCommit: (state: ControlState, impact: ChangeImpact) => void;
}

export interface ReplayFailure {
  readonly record: string;
  readonly issues: readonly Issue[];
}

export class ControlPlane {
  readonly #registry: RendererRegistry;
  readonly #policy: Policy;
  readonly #emitter: TraceEmitter;
  readonly #workflowId: string;
  readonly #now: () => number;
  readonly #onCommit: (state: ControlState, impact: ChangeImpact) => void;
  readonly #initial: ControlState;
  readonly #proposals = new Map<string, Tracked>();
  #records: ChangeRecord[] = [];
  #state: ControlState;
  #seq = 0;

  constructor(options: ControlPlaneOptions) {
    this.#registry = options.registry;
    this.#policy = options.policy;
    this.#emitter = options.emitter;
    this.#workflowId = options.workflowId;
    this.#now = options.now ?? Date.now;
    this.#onCommit = options.onCommit;
    this.#initial = options.initial;
    this.#state = options.initial;
  }

  get state(): ControlState {
    return this.#state;
  }

  // --- Phase one: propose ---------------------------------------------------

  /**
   * Describes a change and puts it to policy.
   *
   * A malformed change produces a proposal carrying its parse issues rather
   * than an exception, so an initiator gets one structured answer from
   * `validate` whatever went wrong.
   */
  async propose(input: unknown, initiator: Initiator): Promise<Proposal> {
    this.#seq += 1;
    const parsed = changeSchema.safeParse(input);
    const change = (parsed.success ? parsed.data : { kind: 'context.patch', values: {} }) as Change;
    const parseIssues: Issue[] = parsed.success
      ? []
      : parsed.error.issues.map((issue) => ({
          severity: 'error' as const,
          rule: 'change.invalid',
          path: `/${issue.path.join('/')}`,
          message: issue.message,
        }));

    const id = deterministicId('proposal', this.#workflowId, String(this.#seq), change.kind);
    const correlationId = `co_p${this.#seq}`;
    const proposal: Proposal = { id, change, initiator, correlationId };

    this.#emitter.emit({
      kind: 'control.proposed',
      correlationId,
      initiator,
      data: { proposal: id, change: change.kind, valid: parsed.success },
    });

    // I6: nothing reaches validation or apply without passing here first.
    const decision = parsed.success
      ? await this.#policy(proposal)
      : ({ effect: 'deny', reason: 'The change document did not parse.' } as PolicyDecision);

    this.#emitter.emit({
      kind: 'control.policy',
      correlationId,
      initiator,
      data: { proposal: id, effect: decision.effect },
    });

    this.#proposals.set(id, {
      proposal,
      decision,
      parseIssues,
      status: statusFor(decision),
    });
    return proposal;
  }

  // --- Phase two: validate --------------------------------------------------

  async validate(proposal: Proposal): Promise<ValidationResult> {
    const tracked = this.#proposals.get(proposal.id);
    if (tracked === undefined) {
      return {
        ok: false,
        issues: [
          {
            severity: 'error',
            rule: 'proposal.unknown',
            identifier: proposal.id,
            message: 'This proposal was never proposed to this control plane.',
            suggestion: 'Call propose() first; a proposal is not a free-floating document.',
          },
        ],
      };
    }

    // A change that did not parse gets its parse issues and nothing else. The
    // policy denial that followed adds no information an initiator can act on,
    // and two explanations for one mistake is worse than one.
    const issues: Issue[] = [...tracked.parseIssues];
    if (issues.length === 0 && tracked.decision.effect === 'deny') {
      issues.push({
        severity: 'error',
        rule: 'policy.denied',
        identifier: proposal.id,
        message: tracked.decision.reason,
      });
    }
    if (issues.length === 0) {
      issues.push(...validateChange(tracked.proposal.change, this.#state, this.#registry));
    }
    if (tracked.decision.effect === 'confirm' && tracked.status === 'pending') {
      issues.push({
        severity: 'warning',
        rule: 'policy.confirmation-required',
        identifier: proposal.id,
        message: tracked.decision.reason,
        suggestion: `Resolve it with confirm("${proposal.id}") or cancel("${proposal.id}").`,
      });
    }

    const ok = !issues.some((candidate) => candidate.severity === 'error');
    this.#emitter.emit({
      kind: 'control.validated',
      correlationId: proposal.correlationId,
      initiator: proposal.initiator,
      data: { proposal: proposal.id, ok, issues: issues.length },
    });
    return { ok, issues };
  }

  // --- Confirmation (OQ4, decision 0027) ------------------------------------

  /** Proposals awaiting a decision from whoever the application asks. */
  pending(): readonly Proposal[] {
    return [...this.#proposals.values()]
      .filter((tracked) => tracked.status === 'pending')
      .map((tracked) => tracked.proposal);
  }

  confirm(proposalId: string): boolean {
    const tracked = this.#proposals.get(proposalId);
    if (tracked?.status !== 'pending') return false;
    tracked.status = 'open';
    return true;
  }

  cancel(proposalId: string): boolean {
    const tracked = this.#proposals.get(proposalId);
    if (tracked?.status !== 'pending') return false;
    tracked.status = 'cancelled';
    return true;
  }

  // --- Phase three: apply ---------------------------------------------------

  async apply(proposal: Proposal): Promise<ChangeRecord> {
    const tracked = this.#proposals.get(proposal.id);
    if (tracked === undefined) {
      throw new Error(`Unknown proposal "${proposal.id}".`);
    }

    // Applying the same validated proposal twice is a no-op with a clear
    // result, so an agent that retries after a dropped response is safe.
    if (tracked.status === 'applied' && tracked.record !== undefined) return tracked.record;

    if (tracked.status !== 'open') {
      throw new Error(
        `Proposal "${proposal.id}" cannot be applied: ${blockedBecause(tracked.status)}.`,
      );
    }

    const validation = await this.validate(proposal);
    if (!validation.ok) {
      throw new Error(
        `Proposal "${proposal.id}" is not valid: ${validation.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => issue.message)
          .join(' ')}`,
      );
    }

    const record: ChangeRecord = {
      id: deterministicId(
        'change',
        this.#workflowId,
        String(this.#records.length),
        proposal.change.kind,
      ),
      proposalId: proposal.id,
      change: proposal.change,
      initiator: proposal.initiator,
      appliedAt: this.#now(),
    };

    if (proposal.change.kind === 'change.revert') {
      return this.#commitRevert(proposal, record);
    }

    const outcome = applyChange(proposal.change, this.#state, this.#registry);
    this.#state = outcome.state;
    this.#records = [...this.#records, record];
    tracked.status = 'applied';
    tracked.record = record;

    this.#emitter.emit({
      kind: 'control.applied',
      correlationId: proposal.correlationId,
      initiator: proposal.initiator,
      data: { change: record.id, kind: proposal.change.kind, impact: outcome.impact },
    });
    this.#onCommit(this.#state, outcome.impact);
    return record;
  }

  // --- Phase four: revert ---------------------------------------------------

  /**
   * Reverts by replaying the log without the named change (decision 0026).
   *
   * Later changes are re-applied against the restored state. One that no longer
   * validates fails the revert with the reason, rather than leaving state no
   * sequence of changes could have produced.
   */
  async revert(changeId: string, initiator?: Initiator): Promise<ChangeRecord> {
    const target = this.#records.find((record) => record.id === changeId);
    if (target === undefined) throw new Error(`Unknown change "${changeId}".`);

    const proposal = await this.propose(
      { kind: 'change.revert', change: changeId },
      initiator ?? target.initiator,
    );
    const validation = await this.validate(proposal);
    if (!validation.ok) {
      throw new Error(
        `Revert of "${changeId}" was refused: ${validation.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => issue.message)
          .join(' ')}`,
      );
    }
    return this.apply(proposal);
  }

  #commitRevert(proposal: Proposal, record: ChangeRecord): ChangeRecord {
    const targetId = (proposal.change as { change: string }).change;
    if (!this.#records.some((existing) => existing.id === targetId)) {
      throw new Error(`Cannot revert "${targetId}": this instance has no such change.`);
    }
    const candidate = [...this.#records, record];
    const replayed = this.#replay(candidate);

    if (replayed.failures.length > 0) {
      const explanation = replayed.failures
        .map(
          (failure) =>
            `${failure.record}: ${failure.issues.map((issue) => issue.message).join(' ')}`,
        )
        .join('; ');
      throw new Error(
        `Reverting "${targetId}" would leave later changes invalid — ${explanation}. Revert those first.`,
      );
    }

    this.#records = candidate.map((existing) =>
      existing.id === targetId ? { ...existing, revertedBy: record.id } : existing,
    );
    this.#state = replayed.state;
    const tracked = this.#proposals.get(proposal.id) as Tracked;
    tracked.status = 'applied';
    tracked.record = record;

    this.#emitter.emit({
      kind: 'control.reverted',
      correlationId: proposal.correlationId,
      initiator: proposal.initiator,
      data: { change: record.id, reverted: targetId },
    });
    this.#onCommit(this.#state, 'graph');
    return record;
  }

  /** Rebuilds state from the initial state, skipping whatever was reverted. */
  #replay(records: readonly ChangeRecord[]): {
    state: ControlState;
    failures: ReplayFailure[];
  } {
    // Whether a change still stands is recursive: a change is reverted if some
    // revert targets it and that revert has not itself been reverted. A toggle
    // gets this wrong the moment a revert of a revert appears, because the
    // second one targets the first revert rather than the original change.
    const revertsByTarget = new Map<string, string[]>();
    for (const record of records) {
      if (record.change.kind !== 'change.revert') continue;
      const target = record.change.change;
      revertsByTarget.set(target, [...(revertsByTarget.get(target) ?? []), record.id]);
    }

    const decided = new Map<string, boolean>();
    const isReverted = (id: string): boolean => {
      const known = decided.get(id);
      if (known !== undefined) return known;
      decided.set(id, false);
      const result = (revertsByTarget.get(id) ?? []).some((revert) => !isReverted(revert));
      decided.set(id, result);
      return result;
    };

    let state = this.#initial;
    const failures: ReplayFailure[] = [];
    for (const record of records) {
      if (record.change.kind === 'change.revert' || isReverted(record.id)) continue;
      const issues = validateChange(record.change, state, this.#registry);
      if (issues.length > 0) {
        failures.push({ record: record.id, issues });
        continue;
      }
      state = applyChange(record.change, state, this.#registry).state;
    }
    return { state, failures };
  }

  // --- The log, and putting it back (OQ1, decision 0028) --------------------

  log(): readonly ChangeRecord[] {
    return [...this.#records];
  }

  /**
   * Restores persisted change records.
   *
   * Each one is re-proposed with its recorded initiator, so it meets policy
   * again. A change an initiator is no longer entitled to is dropped rather
   * than restored, which is what makes persisted personalization safe to reload
   * after someone's permissions changed.
   */
  async hydrate(records: readonly ChangeRecord[]): Promise<{
    applied: number;
    dropped: readonly { record: string; reason: string }[];
  }> {
    const dropped: { record: string; reason: string }[] = [];
    let applied = 0;

    for (const record of records) {
      // A reverted change and the revert that undid it both drop out: skipping
      // the first already expresses the second, and replaying a revert against
      // a log that never held its target means nothing.
      if (record.revertedBy !== undefined || record.change.kind === 'change.revert') continue;
      const proposal = await this.propose(record.change, record.initiator);
      const validation = await this.validate(proposal);
      if (!validation.ok) {
        dropped.push({
          record: record.id,
          reason: validation.issues.map((issue) => issue.message).join(' '),
        });
        continue;
      }
      await this.apply(proposal);
      applied += 1;
    }
    return { applied, dropped };
  }

  // --- Introspection --------------------------------------------------------

  describe(): Description {
    const document: WorkflowDocument = this.#state.document;
    return {
      workflow: {
        id: document.id,
        name: document.name,
        ...(document.description !== undefined ? { description: document.description } : {}),
      },
      nodes: document.nodes.map((node) => ({
        id: node.id,
        ...(node.description !== undefined ? { description: node.description } : {}),
      })),
      surfaces: document.nodes.flatMap((node) =>
        (node.surfaces ?? []).map((surface) => {
          const resolution = this.#registry.resolve({
            id: surface.id as string,
            nodeId: node.id,
            type: surface.type,
            props: {},
            getters: {},
          });
          return {
            id: surface.id as string,
            nodeId: node.id,
            type: surface.type,
            ...(surface.description !== undefined ? { description: surface.description } : {}),
            ...(resolution !== undefined ? { renderer: resolution.renderer } : {}),
          };
        }),
      ),
      registries: [{ id: this.#registry.id, entries: this.#state.registryEntries.length }],
      capabilities: [
        ...(document.requires?.guards ?? []).map((name) => ({ kind: 'guard', name })),
        ...(document.requires?.services ?? []).map((name) => ({ kind: 'service', name })),
        ...(document.requires?.dataSources ?? []).map((name) => ({ kind: 'dataSource', name })),
      ],
    };
  }

  /** Self-describing operations, ready to become tool definitions (§6). */
  operations(): readonly OperationDescriptor[] {
    const schemas = exportJsonSchemas();
    const change = schemas['leyline-change'] as Record<string, unknown>;
    const record = schemas['leyline-change-record'] as Record<string, unknown>;
    const proposal = schemas['leyline-proposal'] as Record<string, unknown>;
    const issues = schemas['leyline-issue'] as Record<string, unknown>;

    return [
      {
        name: 'describe',
        description:
          'Reports the workflow, its nodes and surfaces with descriptions, the registries, and the capabilities it requires.',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object' },
      },
      {
        name: 'propose',
        description: 'Describes a change and puts it to policy. Nothing is committed.',
        inputSchema: change,
        outputSchema: proposal,
      },
      {
        name: 'validate',
        description:
          'Checks a proposal against current state and returns structured issues. Safe to call as a dry run.',
        inputSchema: proposal,
        outputSchema: {
          type: 'object',
          properties: { ok: { type: 'boolean' }, issues: { type: 'array', items: issues } },
        },
      },
      {
        name: 'apply',
        description:
          'Commits a validated proposal, producing a change record. Applying twice is a no-op.',
        inputSchema: proposal,
        outputSchema: record,
      },
      {
        name: 'revert',
        description:
          'Undoes an applied change by identifier, replaying later changes against the restored state.',
        inputSchema: {
          type: 'object',
          properties: { change: { type: 'string' } },
          required: ['change'],
        },
        outputSchema: record,
      },
      {
        name: 'log',
        description: 'The ordered record of applied changes.',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'array', items: record },
      },
    ];
  }
}

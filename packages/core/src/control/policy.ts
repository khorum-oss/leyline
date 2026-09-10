import type { Change, Initiator } from '@leyline/schema';
import type { Policy, PolicyDecision, Proposal } from '../control-plane.js';
import type { RuntimeMode } from '../contracts.js';

/**
 * Policy: what an initiator may change (AD13, decision 0024).
 *
 * One predicate receiving the whole proposal, plus combinators for the cases
 * that recur. A single function is the smallest thing that can express any
 * rule; the combinators keep the common ones declarative without inventing a
 * configuration language that would need its own schema, its own versioning,
 * and its own answer the first time it could not express something.
 */

export const allow: PolicyDecision = { effect: 'allow' };

export const permissive: Policy = () => allow;

export const denyAll: Policy = () => ({
  effect: 'deny',
  reason: 'This instance accepts no changes.',
});

/** Allows only the named change kinds; everything else is denied. */
export function allowKinds(...kinds: readonly Change['kind'][]): Policy {
  const allowed = new Set<string>(kinds);
  return (proposal) =>
    allowed.has(proposal.change.kind)
      ? allow
      : {
          effect: 'deny',
          reason: `"${proposal.change.kind}" is not among the permitted change kinds: ${[...allowed].join(', ')}.`,
        };
}

export function denyKinds(...kinds: readonly Change['kind'][]): Policy {
  const denied = new Set<string>(kinds);
  return (proposal) =>
    denied.has(proposal.change.kind)
      ? { effect: 'deny', reason: `"${proposal.change.kind}" is not permitted here.` }
      : allow;
}

/** Applies a policy only to one kind of initiator; everything else is allowed. */
export function forInitiator(kind: Initiator['kind'], policy: Policy): Policy {
  return (proposal) => (proposal.initiator.kind === kind ? policy(proposal) : allow);
}

export function requireConfirmation(reason: string, kinds?: readonly Change['kind'][]): Policy {
  const affected = kinds === undefined ? undefined : new Set<string>(kinds);
  return (proposal) =>
    affected === undefined || affected.has(proposal.change.kind)
      ? { effect: 'confirm', reason }
      : allow;
}

async function decide(policy: Policy, proposal: Proposal): Promise<PolicyDecision> {
  return await policy(proposal);
}

/**
 * Every policy must agree.
 *
 * A denial from any of them denies; short of that, a confirmation requirement
 * from any of them stands. The strictest answer wins, which is the only
 * composition rule that cannot be used to weaken a policy by adding another.
 */
export function allOf(...policies: readonly Policy[]): Policy {
  return async (proposal) => {
    let pending: PolicyDecision | undefined;
    for (const policy of policies) {
      const decision = await decide(policy, proposal);
      if (decision.effect === 'deny') return decision;
      if (decision.effect === 'confirm') pending ??= decision;
    }
    return pending ?? allow;
  };
}

/** Any policy allowing is enough. Denials are collected so the reason survives. */
export function anyOf(...policies: readonly Policy[]): Policy {
  return async (proposal) => {
    const reasons: string[] = [];
    let pending: PolicyDecision | undefined;
    for (const policy of policies) {
      const decision = await decide(policy, proposal);
      if (decision.effect === 'allow') return allow;
      if (decision.effect === 'confirm') pending ??= decision;
      else reasons.push(decision.reason);
    }
    if (pending !== undefined) return pending;
    return {
      effect: 'deny',
      reason: reasons.length > 0 ? reasons.join(' ') : 'No policy allowed this change.',
    };
  };
}

/**
 * What an instance does when the application configured no policy (brief §8).
 *
 * Development is permissive, because a developer at a REPL is the application.
 * Production denies agents and end users: both are initiators whose authority
 * an application has to grant deliberately, and defaulting them open would make
 * the safe configuration the one you have to remember.
 *
 * The mode is named at construction and never inferred, so this default is
 * always a choice someone made rather than an environment variable's accident.
 */
export function defaultPolicy(mode: RuntimeMode): Policy {
  if (mode === 'development') return permissive;
  return (proposal) =>
    proposal.initiator.kind === 'agent' || proposal.initiator.kind === 'user'
      ? {
          effect: 'deny',
          reason: `In production an instance with no configured policy accepts no changes from a ${proposal.initiator.kind} initiator. Configure a policy to permit specific ones.`,
        }
      : allow;
}

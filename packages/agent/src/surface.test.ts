import { describe, expect, it } from 'vitest';
import { createAgentSurface } from './surface.js';
import { hostWorkflow, settle } from './testing/scenario.js';

/**
 * The identity boundary (decision 0031).
 *
 * The surface sits between an untrusted caller and the control plane, and it is
 * the only place that decides who a call speaks for.
 */

describe('identity is fixed at construction', () => {
  it('attributes every change to the initiator the host chose', async () => {
    const workflow = await hostWorkflow();
    const surface = createAgentSurface(workflow, {
      initiator: { kind: 'agent', label: 'card-grid-swap' },
    });

    const proposed = await surface.handle('leyline_propose', {
      change: { kind: 'context.patch', values: { tier: 'paid' } },
    });
    expect(proposed.ok).toBe(true);
    const id = (proposed as { value: { id: string } }).value.id;
    await surface.handle('leyline_apply', { id });

    const record = workflow.control.log().at(-1);
    expect(record?.initiator).toEqual({ kind: 'agent', label: 'card-grid-swap' });
  });

  it('offers a caller no way to say who it is', async () => {
    const workflow = await hostWorkflow();
    const surface = createAgentSurface(workflow, { initiator: { kind: 'agent', label: 'honest' } });

    // The propose tool takes a change and nothing else; an initiator sent
    // alongside it has nowhere to go.
    const proposed = await surface.handle('leyline_propose', {
      change: { kind: 'context.patch', values: { tier: 'paid' } },
      initiator: { kind: 'application', label: 'definitely-the-app' },
    });
    const id = (proposed as { value: { id: string } }).value.id;
    await surface.handle('leyline_apply', { id });

    expect(workflow.control.log().at(-1)?.initiator).toEqual({ kind: 'agent', label: 'honest' });
  });

  it('defaults to an agent initiator, because that is who connects', async () => {
    const workflow = await hostWorkflow();
    const surface = createAgentSurface(workflow);
    const proposed = await surface.handle('leyline_propose', {
      change: { kind: 'context.patch', values: { tier: 'paid' } },
    });
    await surface.handle('leyline_apply', {
      id: (proposed as { value: { id: string } }).value.id,
    });
    expect(workflow.control.log().at(-1)?.initiator.kind).toBe('agent');
  });
});

describe('attestation is attached, never accepted (OQ7)', () => {
  it('carries what the host authenticated onto every change', async () => {
    const workflow = await hostWorkflow();
    const surface = createAgentSurface(workflow, {
      attestation: { subject: 'svc_reviewer', via: 'mtls' },
    });

    const proposed = await surface.handle('leyline_propose', {
      change: { kind: 'context.patch', values: { tier: 'paid' } },
    });
    await surface.handle('leyline_apply', {
      id: (proposed as { value: { id: string } }).value.id,
    });

    expect(workflow.control.log().at(-1)?.initiator.attested).toEqual({
      subject: 'svc_reviewer',
      via: 'mtls',
    });
  });

  it('discards an attestation a caller tries to supply', async () => {
    const workflow = await hostWorkflow();
    // Nothing authenticated this connection.
    const surface = createAgentSurface(workflow, { initiator: { kind: 'agent' } });

    const proposed = await surface.handle('leyline_propose', {
      change: { kind: 'context.patch', values: { tier: 'paid' } },
      attested: { subject: 'admin', via: 'trust-me' },
    });
    await surface.handle('leyline_apply', {
      id: (proposed as { value: { id: string } }).value.id,
    });

    expect(workflow.control.log().at(-1)?.initiator.attested).toBeUndefined();
  });

  it('lets a policy require one, which is where enforcement belongs', async () => {
    const workflow = await hostWorkflow({
      // Required of agents, not of the application's own startup registrations,
      // which arrive over no transport at all.
      policy: (proposal: { initiator: { kind: string; attested?: unknown } }) =>
        proposal.initiator.kind === 'agent' && proposal.initiator.attested === undefined
          ? {
              effect: 'deny',
              reason: 'This instance accepts changes only over an authenticated connection.',
            }
          : { effect: 'allow' },
    });
    await settle();

    const anonymous = createAgentSurface(workflow);
    const proposed = await anonymous.handle('leyline_propose', {
      change: { kind: 'context.patch', values: { tier: 'paid' } },
    });
    const validation = await anonymous.handle('leyline_validate', {
      id: (proposed as { value: { id: string } }).value.id,
    });
    expect((validation as { value: { ok: boolean } }).value.ok).toBe(false);

    const authenticated = createAgentSurface(workflow, {
      attestation: { subject: 'svc_reviewer', via: 'mtls' },
    });
    const allowed = await authenticated.handle('leyline_propose', {
      change: { kind: 'context.patch', values: { tier: 'paid' } },
    });
    const ok = await authenticated.handle('leyline_validate', {
      id: (allowed as { value: { id: string } }).value.id,
    });
    expect((ok as { value: { ok: boolean } }).value.ok).toBe(true);
  });
});

describe('what the surface deliberately does not offer', () => {
  it('has no way to confirm a proposal policy held for confirmation', async () => {
    const workflow = await hostWorkflow();
    const surface = createAgentSurface(workflow);
    const names = surface.tools().map((tool) => tool.name);

    // An agent confirming its own proposal would make "require confirmation"
    // mean nothing (decision 0027).
    expect(names).not.toContain('leyline_confirm');
    expect(names).not.toContain('leyline_cancel');
    expect(names).toContain('leyline_pending');
  });

  it('marks which operations write, so a host can gate them separately', async () => {
    const workflow = await hostWorkflow();
    const surface = createAgentSurface(workflow);
    const mutating = surface
      .tools()
      .filter((tool) => tool.mutates)
      .map((tool) => tool.name);
    expect(mutating).toEqual(['leyline_apply', 'leyline_revert']);
  });
});

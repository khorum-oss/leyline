import { createAgentSurface } from '@leyline/agent';
import { allowKinds, forInitiator, type Policy, type WorkflowInstance } from '@leyline/core';
import type { WorkspaceContext } from './workflow.js';

/**
 * The page, answering for its own workflow.
 *
 * Everything an agent changes here goes through the control plane the buttons
 * along the top already use. There is no second path and no privileged one —
 * which is why a change made from a terminal redraws the page without anything
 * here knowing that a terminal was involved.
 */

/**
 * What this deployment lets an agent do, decided in the page rather than in the
 * relay. The relay carries bytes; it is not trusted to say who may do what.
 *
 * Nothing here enumerates renderers. An agent may name only what the
 * application published to the catalogue, and the control plane enforces that
 * rather than this policy (I3).
 */
export const policy: Policy = forInitiator(
  'agent',
  allowKinds(
    'renderer.register',
    'renderer.unregister',
    'surface.attach-guard',
    'surface.detach-guard',
    'section.reorder-children',
    'change.revert',
  ),
);

export type BridgeStatus = 'connecting' | 'live' | 'offline';

interface Call {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

/**
 * Subscribes the workflow to tool calls relayed from a CLI agent.
 *
 * Returns a teardown, so a tier change — which builds a new workflow — retires
 * the old subscription with it rather than leaving two pages' worth of surface
 * answering the same relay.
 */
export function connectAgentBridge(
  workflow: WorkflowInstance<WorkspaceContext>,
  onStatus: (status: BridgeStatus) => void,
): () => void {
  const surface = createAgentSurface(workflow, {
    initiator: { kind: 'agent', label: 'leyline-live' },
  });

  const events = new EventSource('/agent/events');
  onStatus('connecting');

  events.onopen = () => onStatus('live');
  events.onerror = () => onStatus('offline');

  events.onmessage = (event: MessageEvent<string>) => {
    const call = JSON.parse(event.data) as Call;
    void surface.handle(call.name, call.input).then((result) =>
      fetch('/agent/result', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: call.id, result }),
      }),
    );
  };

  return () => events.close();
}

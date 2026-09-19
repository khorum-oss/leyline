import { createAgentSurface, type AgentSurface } from '@khorum-oss/leyline-agent';
import {
  allowKinds,
  forInitiator,
  walkRegions,
  type Policy,
  type WorkflowInstance,
} from '@khorum-oss/leyline-core';
import { start, type WorkspaceContext } from '@leyline-examples/scenario';

/**
 * The application side of the demonstration.
 *
 * An agent never sees any of this. It sees the tools the surface publishes and
 * the JSON Schema describing them — which is the point: everything below is the
 * host's decision, made once, at construction.
 */

export interface Session {
  readonly workflow: WorkflowInstance<WorkspaceContext>;
  readonly surface: AgentSurface;
}

/**
 * What this deployment is willing to let an agent do.
 *
 * Production mode with no policy refuses agent initiators outright (I6), so
 * saying nothing is not an option — a deployment that wants agents has to say
 * what they may do. This one lets an agent rearrange and change eligibility,
 * and refuses to let it replace the document wholesale.
 *
 * Worth noticing what is *not* here: nothing enumerates renderers. An agent may
 * name only what the application published to the catalogue, and that is
 * enforced by the control plane rather than by this policy (I3).
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

export async function openSession(tier = 'free'): Promise<Session> {
  // No components: this workflow is never drawn. The catalogue still publishes
  // what each renderer is for, because that is what an agent reads when it
  // decides which one to name.
  const workflow = await start({ components: {}, tier, policy });

  const surface = createAgentSurface(workflow, {
    initiator: { kind: 'agent', label: 'leyline-agent-cli' },
  });

  return { workflow, surface };
}

/** What is on screen, as text — so a terminal can show what a change did. */
export function renderText(workflow: WorkflowInstance<WorkspaceContext>): string {
  const snapshot = workflow.getSnapshot();
  const lines: string[] = [];

  for (const region of walkRegions(snapshot.root)) {
    lines.push(`▸ ${region.id} (${region.kind})`);
    for (const surface of region.surfaces) {
      const renderer = workflow.resolve(surface)?.renderer ?? '— nothing claims it —';
      const data =
        surface.data === undefined ? '' : ` ${JSON.stringify(surface.data).slice(0, 60)}`;
      lines.push(`    ${surface.id} [${surface.type}] → ${renderer}${data}`);
    }
  }

  lines.push(`  status: ${snapshot.status}  tier: ${String(snapshot.context.tier)}`);
  return lines.join('\n');
}

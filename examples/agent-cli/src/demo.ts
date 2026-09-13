import type { Session } from './session.js';
import { renderText } from './session.js';
import { bold, cyan, dim, printResult } from './format.js';

/**
 * Brief §2 items 6 and 7, scripted.
 *
 * No API key, no model, no network — and every call goes through exactly the
 * interface a model would use. That is the claim worth testing: if a scripted
 * run and a language model need different code paths, the agent surface has
 * failed at its one job.
 *
 * Two of the steps are meant to fail, and they are the interesting ones. Both
 * surface at `leyline_validate`, for different reasons — one is the catalogue
 * gate, the other is this deployment's policy — and both come back as data
 * carrying the rule that was violated.
 */

const SWAP: unknown = {
  kind: 'renderer.register',
  registry: 'default',
  renderer: 'CardGrid',
  match: { surfaceId: 'actions' },
  rank: 80,
};

export async function runDemo(session: Session): Promise<void> {
  const { surface, workflow } = session;

  console.log(bold('\nWhat is on screen\n'));
  console.log(renderText(workflow));

  console.log(
    `\n${cyan('1')} Look around. An agent with no access to application source starts here.`,
  );
  printResult('leyline_describe', await surface.handle('leyline_describe'));

  // --- The two refusals, and where each one happens -------------------------

  console.log(`\n${cyan('2')} Name a renderer the application never published.`);
  await proposeAndValidate(session, { ...(SWAP as object), renderer: 'MyOwnComponent' });
  console.log(
    dim(
      '  Propose records; validate is where you find out why not. The deployment\n' +
        '  permits this kind of change, so policy allowed it — what it cannot do is\n' +
        '  name a renderer outside the catalogue, and that is the control plane\n' +
        '  rather than the policy (I3). Note the suggestion: the refusal names every\n' +
        '  renderer that would have been legal. An agent cannot supply a component.',
    ),
  );

  console.log(`\n${cyan('3')} Try a change kind this deployment does not permit.`);
  await proposeAndValidate(session, { kind: 'context.patch', values: { tier: 'organization' } });
  console.log(
    dim(
      '  A perfectly valid change, refused for a different reason: `policy.denied`.\n' +
        '  The decision was taken at propose, before validation ran — policy is\n' +
        '  consulted first and nothing skips it, not apply and not revert (I6).\n' +
        "  Which changes an agent may make is the deployment's call, and this one\n" +
        '  lets it rearrange the UI but not write context.',
    ),
  );

  // --- The two changes the brief asks for -----------------------------------

  console.log(`\n${cyan('4')} Item 6: swap the actions table for a card grid.`);
  const swapId = await apply(session, SWAP);

  console.log(bold('\nAfter the swap\n'));
  console.log(renderText(workflow));

  console.log(`\n${cyan('5')} Item 7: hide the metrics panel unless the tier pays for it.`);
  await apply(session, {
    kind: 'surface.attach-guard',
    node: 'workspace-hub',
    surface: 'metrics',
    guard: 'needsBilling',
  });
  console.log(
    dim(
      '  On a free tier `needsBilling` is false, so the metrics surface is now\n' +
        '  absent from the snapshot entirely — not passed to a component that\n' +
        '  received it and chose not to draw it. No component learned anything.\n' +
        '  Run with `--tier paid` and the same change leaves it in place.',
    ),
  );

  console.log(bold('\nAfter the guard\n'));
  console.log(renderText(workflow));

  console.log(`\n${cyan('6')} Revert the card grid.`);
  printResult('leyline_revert', await surface.handle('leyline_revert', { id: swapId }));

  console.log(bold('\nAfter the revert\n'));
  console.log(renderText(workflow));

  console.log(`\n${cyan('7')} The audit trail — every change, and what reverted what.`);
  printResult('leyline_log', await surface.handle('leyline_log'));
}

/** Propose, then validate. Stops at whichever one refuses. */
async function proposeAndValidate(session: Session, change: unknown): Promise<string> {
  const proposed = await session.surface.handle('leyline_propose', { change });
  printResult('leyline_propose', proposed);
  if (!proposed.ok) return '';

  const id = (proposed.value as { id: string }).id;
  const validated = await session.surface.handle('leyline_validate', { id });
  printResult('leyline_validate', validated);
  return validated.ok ? id : '';
}

/** Propose, validate, apply — and hand back the change record id. */
async function apply(session: Session, change: unknown): Promise<string> {
  const id = await proposeAndValidate(session, change);
  if (id === '') return '';

  const applied = await session.surface.handle('leyline_apply', { id });
  printResult('leyline_apply', applied);
  return applied.ok ? (applied.value as { id: string }).id : '';
}

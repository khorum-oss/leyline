import { mount, FALLBACK_RENDERERS } from '@leyline/vanilla';
import {
  HIDE_METRICS_ON_FREE,
  SWAP_TO_CARDS,
  applyChange,
  start,
  type WorkspaceContext,
} from '@leyline-examples/scenario';
import type { TraceEvent, WorkflowInstance } from '@leyline/core';
import { ActionsTable, CardGrid, LinkButton, MetricsPanel, Panel, TextBlock } from './renderers.js';
import '@leyline-examples/scenario/styles.css';

/**
 * The §2 scenario with no framework at all.
 *
 * Compare it with the React and Svelte examples: the same document, the same
 * capabilities, the same control plane, the same two changes. What is missing
 * is a framework — and what that costs is visible right here, in the twenty
 * lines below that wire a `<select>` and three buttons by hand.
 *
 * Each published snapshot replaces the container outright. No diffing to get
 * subtly wrong, and the cost of having no framework stays visible rather than
 * hidden.
 */

type Workflow = WorkflowInstance<WorkspaceContext>;

const AGENT = { kind: 'agent', label: 'demo' } as const;
const components = { ActionsTable, CardGrid, MetricsPanel, LinkButton, TextBlock, Panel };

const root = document.getElementById('root') as HTMLElement;
root.innerHTML = `
  <main>
    <header>
      <h1>Workspace onboarding</h1>
      <p>The brief&rsquo;s §2 scenario, with no framework. The same document the React and Svelte
      examples render, through the same control plane.</p>
    </header>
    <nav class="controls">
      <label>Tier
        <select id="tier">
          <option value="free">free (skips billing)</option>
          <option value="paid" selected>paid</option>
          <option value="organization">organization</option>
        </select>
      </label>
      <button type="button" id="cards">Swap the table for cards</button>
      <button type="button" id="guard">Hide metrics on free tiers</button>
      <button type="button" id="revert">Revert the last change</button>
    </nav>
    <p class="note" id="note"></p>
    <div class="view" id="view"></div>
    <section class="trace"><h2>Trace</h2><ol id="trace"></ol></section>
  </main>
`;

const view = root.querySelector<HTMLElement>('#view') as HTMLElement;
const noteEl = root.querySelector<HTMLElement>('#note') as HTMLElement;
const traceEl = root.querySelector<HTMLElement>('#trace') as HTMLElement;

let workflow: Workflow | undefined;
let unmount: (() => void) | undefined;

const note = (message: string): void => {
  noteEl.textContent = message;
};

function drawTrace(event: TraceEvent): void {
  const item = document.createElement('li');
  const kind = document.createElement('code');
  kind.textContent = event.kind;
  const correlation = document.createElement('span');
  correlation.className = 'dim';
  correlation.textContent = event.correlationId;
  item.append(kind, ' ', correlation);
  traceEl.append(item);
  while (traceEl.childElementCount > 40) traceEl.firstElementChild?.remove();
}

async function restart(tier: string): Promise<void> {
  unmount?.();
  traceEl.replaceChildren();
  note('');
  workflow = await start({ components, fallbacks: FALLBACK_RENDERERS, tier });
  workflow.trace.attach(drawTrace);
  unmount = mount(workflow, { container: view });
}

// Every button below is a proposal, a validation, and an apply — reaching the
// same control plane an agent reaches, and meeting the same policy.
const act = (change: unknown) => () => {
  if (workflow) void applyChange(workflow, change, AGENT).then(note);
};

root.querySelector('#cards')?.addEventListener('click', act(SWAP_TO_CARDS));
root.querySelector('#guard')?.addEventListener('click', act(HIDE_METRICS_ON_FREE));

root.querySelector('#revert')?.addEventListener('click', () => {
  const last = workflow?.control.log().at(-1);
  if (!workflow || !last) return note('nothing to revert');
  void workflow.control.revert(last.id).then(
    (record) => note(`reverted ${record.id}`),
    (error: unknown) => note(String(error)),
  );
});

root.querySelector<HTMLSelectElement>('#tier')?.addEventListener('change', (event) => {
  void restart((event.target as HTMLSelectElement).value);
});

void restart('paid');

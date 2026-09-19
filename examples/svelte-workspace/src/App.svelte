<script lang="ts">
  import { WorkflowView } from '@khorum-oss/leyline-svelte';
  import { HIDE_METRICS_ON_FREE, SWAP_TO_CARDS, applyChange } from '@leyline-examples/scenario';
  import type { TraceEvent, WorkflowInstance } from '@khorum-oss/leyline-core';
  import { start, type WorkspaceContext } from './workflow.js';

  /**
   * The §2 scenario in Svelte.
   *
   * Compare it with `examples/react-workspace/src/App.tsx`: the same document,
   * the same capabilities, the same control plane, the same changes. What
   * differs is `$state` instead of `useState` — which is the point.
   */

  type Workflow = WorkflowInstance<WorkspaceContext>;

  const AGENT = { kind: 'agent', label: 'demo' } as const;

  let tier = $state('paid');
  let workflow = $state<Workflow | undefined>();
  let events = $state<TraceEvent[]>([]);
  let note = $state('');

  $effect(() => {
    const wanted = tier;
    let live = true;
    void start(wanted).then((next) => {
      if (!live) return;
      workflow = next;
      events = [];
      next.trace.attach((event) => {
        events = [...events.slice(-40), event];
      });
    });
    return () => {
      live = false;
    };
  });

  // Every button below is a proposal, a validation, and an apply — reaching the
  // same control plane an agent reaches, and meeting the same policy.
  const act = (change: unknown) => () => {
    if (workflow) void applyChange(workflow, change, AGENT).then((result) => (note = result));
  };

  function revertLast(): void {
    if (!workflow) return;
    const last = workflow.control.log().at(-1);
    if (!last) {
      note = 'nothing to revert';
      return;
    }
    void workflow.control.revert(last.id).then(
      (record) => (note = `reverted ${record.id}`),
      (error: unknown) => (note = String(error)),
    );
  }
</script>

<main>
  <header>
    <h1>Workspace onboarding</h1>
    <p>
      The brief&rsquo;s §2 scenario, in Svelte. The same document the React example renders, through
      the same control plane.
    </p>
  </header>

  <nav class="controls">
    <label>
      Tier
      <select bind:value={tier}>
        <option value="free">free (skips billing)</option>
        <option value="paid">paid</option>
        <option value="organization">organization</option>
      </select>
    </label>

    <button type="button" onclick={act(SWAP_TO_CARDS)}>Swap the table for cards</button>
    <button type="button" onclick={act(HIDE_METRICS_ON_FREE)}>Hide metrics on free tiers</button>
    <button type="button" onclick={revertLast}>Revert the last change</button>
  </nav>

  {#if note}<p class="note">{note}</p>{/if}

  {#if workflow}
    <div class="view"><WorkflowView {workflow} /></div>
  {:else}
    <p>Starting…</p>
  {/if}

  <section class="trace">
    <h2>Trace</h2>
    <ol>
      {#each events as event (event.seq)}
        <li><code>{event.kind}</code> <span class="dim">{event.correlationId}</span></li>
      {/each}
    </ol>
  </section>
</main>

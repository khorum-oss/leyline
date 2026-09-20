<script lang="ts" generics="TContext extends Record<string, unknown>">
  import { buildRenderPlan, type WorkflowInstance } from '@khorum-oss/leyline-core';
  import { toSvelteStore } from './store.js';
  import { toRegionSlot } from './plan.js';

  /**
   * Renders the active region tree of a workflow.
   *
   * The core resolves what is active and what claims it; this subscribes
   * through Svelte's own store contract and mounts the result. There is no
   * workflow logic here — guards are evaluated, data sources attached, and
   * reading order decided before a snapshot arrives (AD6).
   */
  const { workflow }: { workflow: WorkflowInstance<TContext> } = $props();

  const snapshot = $derived(toSvelteStore(workflow));
  const root = $derived(toRegionSlot(buildRenderPlan(workflow, $snapshot.root)));
</script>

<root.component {...root.props} />

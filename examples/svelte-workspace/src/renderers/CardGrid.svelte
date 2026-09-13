<script lang="ts">
  import type { SurfaceRendererProps } from '@leyline/svelte';

  const { surface }: SurfaceRendererProps = $props();
  const actions = $derived((surface.data ?? []) as { id: string; label: string }[]);
</script>

<ul class="cards">
  {#each actions as action (action.id)}
    <li class="card">{action.label}</li>
  {/each}
</ul>

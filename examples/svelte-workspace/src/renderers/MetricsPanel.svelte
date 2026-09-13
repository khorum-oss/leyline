<script lang="ts">
  import type { SurfaceRendererProps } from '@leyline/svelte';

  const { surface }: SurfaceRendererProps = $props();
  const metrics = $derived(Object.entries((surface.data ?? {}) as Record<string, unknown>));
</script>

<dl class="metrics">
  {#each metrics as [name, value] (name)}
    <div>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </div>
  {/each}
</dl>

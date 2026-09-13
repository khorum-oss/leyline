<script lang="ts">
  import type { RegionRendererProps } from './types.js';

  /** Drawn when nothing claims a region: a plain container, children in reading order. */
  const { region, surfaces, regions }: RegionRendererProps = $props();
</script>

<div data-leyline-region={region.id} data-leyline-kind={region.kind}>
  {#each surfaces as slot (slot.id)}
    <slot.component {...slot.props} />
  {/each}
  {#each regions as slot (slot.id)}
    <slot.component {...slot.props} />
  {/each}
</div>

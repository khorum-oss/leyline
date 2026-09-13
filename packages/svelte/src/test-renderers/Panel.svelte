<script lang="ts">
  import type { RegionRendererProps } from '../lib/types.js';
  const { region, surfaces, regions }: RegionRendererProps = $props();
</script>

<section data-testid={`region-${region.id}`}>
  {#each surfaces as slot (slot.id)}<slot.component {...slot.props} />{/each}
  {#each regions as slot (slot.id)}<slot.component {...slot.props} />{/each}
</section>

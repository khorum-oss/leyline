<script lang="ts">
  import type { RegionRendererProps } from '@leyline/svelte';

  /**
   * A region renderer decides where its children go. The slots carry a component
   * and its props rather than a rendered element, because that is how Svelte
   * mounts something dynamic — the one real difference from the React example,
   * and it is about Svelte rather than about anything Leyline decided.
   */
  const { region, surfaces, regions }: RegionRendererProps = $props();
</script>

<section class="panel">
  {#if region.description}<p class="caption">{region.description}</p>{/if}
  {#each surfaces as slot (slot.id)}
    <div class="surface"><slot.component {...slot.props} /></div>
  {/each}
  {#each regions as slot (slot.id)}
    <div><slot.component {...slot.props} /></div>
  {/each}
</section>

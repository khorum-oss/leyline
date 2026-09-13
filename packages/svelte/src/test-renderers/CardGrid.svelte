<script lang="ts">
  import type { SurfaceRendererProps } from '../lib/types.js';
  const { surface }: SurfaceRendererProps = $props();
  const rows = $derived((surface.data ?? []) as { id: string }[]);
</script>

<ul data-testid={surface.id} data-variant="cards">
  {#each rows as row (row.id)}<li>{row.id}</li>{/each}
</ul>

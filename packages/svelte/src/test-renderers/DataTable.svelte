<script lang="ts">
  import type { SurfaceRendererProps } from '../lib/types.js';
  const { surface }: SurfaceRendererProps = $props();
  const rows = $derived((surface.data ?? []) as { id: string }[]);
</script>

<table data-testid={surface.id}>
  <tbody>
    {#each rows as row (row.id)}<tr><td>{row.id}</td></tr>{/each}
  </tbody>
</table>

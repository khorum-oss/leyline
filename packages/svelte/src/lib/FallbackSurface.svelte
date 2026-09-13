<script lang="ts">
  import type { SurfaceRendererProps } from './types.js';

  /**
   * Drawn when nothing in the registry claims a surface.
   *
   * No styling. It exists so an unclaimed surface is visible and addressable
   * rather than silently missing, and so a document containing surface types
   * this build has never heard of still renders (AD8).
   */
  const { surface }: SurfaceRendererProps = $props();
</script>

<div data-leyline-surface={surface.id} data-leyline-type={surface.type}>{surface.type}</div>

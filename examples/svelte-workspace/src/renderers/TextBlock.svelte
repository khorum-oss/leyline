<script lang="ts">
  import type { SurfaceRendererProps } from '@khorum-oss/leyline-svelte';

  const { surface }: SurfaceRendererProps = $props();
</script>

<p class="text">{surface.props['value'] ?? ''}</p>

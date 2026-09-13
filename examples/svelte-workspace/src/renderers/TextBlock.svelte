<script lang="ts">
  import type { SurfaceRendererProps } from '@leyline/svelte';

  const { surface }: SurfaceRendererProps = $props();
</script>

<p class="text">{surface.props['value'] ?? ''}</p>

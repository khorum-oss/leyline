<script lang="ts">
  import type { SurfaceRendererProps } from '../lib/types.js';
  const { surface }: SurfaceRendererProps = $props();
  const link = $derived(surface.getters['link']?.() as { onActivate: () => void } | undefined);
</script>

<button type="button" data-testid={surface.id} onclick={() => link?.onActivate()}>
  {surface.props['label'] ?? surface.id}
</button>

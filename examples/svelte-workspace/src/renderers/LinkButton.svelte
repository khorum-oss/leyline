<script lang="ts">
  import type { SurfaceRendererProps } from '@khorum-oss/leyline-svelte';

  /**
   * Behaviour arrives as a prop-getter rather than as a component the core
   * supplied (AD7). Leyline says what activating this link means; the markup,
   * the class, and the element are entirely this application's business.
   */
  const { surface }: SurfaceRendererProps = $props();
  const link = $derived(surface.getters['link']?.() as { onActivate: () => void } | undefined);
</script>

<button type="button" class="link" onclick={() => link?.onActivate()}>
  {surface.props['label'] ?? surface.id}
</button>

<script lang="ts">
  import type { SurfaceRendererProps } from '../lib/types.js';
  const { surface }: SurfaceRendererProps = $props();
</script>

<dl data-testid={surface.id}><dd>{(surface.data as { members?: number })?.members ?? ''}</dd></dl>

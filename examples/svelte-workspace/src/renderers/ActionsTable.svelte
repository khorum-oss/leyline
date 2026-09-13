<script lang="ts">
  import type { SurfaceRendererProps } from '@leyline/svelte';

  /**
   * Nothing here knows what a guard is or when it ran. A surface arrives with
   * its data attached and its presence already decided (AD6); this draws it.
   */
  const { surface }: SurfaceRendererProps = $props();
  const actions = $derived((surface.data ?? []) as { id: string; label: string }[]);
</script>

<table class="table">
  <tbody>
    {#each actions as action (action.id)}
      <tr><td>{action.label}</td></tr>
    {/each}
  </tbody>
</table>

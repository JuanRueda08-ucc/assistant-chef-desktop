<script lang="ts">
  import type { Snippet } from 'svelte'

  // Opción que se marca y desmarca. Seleccionada: amarilla con el trazo de tinta.
  interface Props {
    seleccionado?: boolean
    onclick?: () => void
    children: Snippet
  }
  let { seleccionado = false, onclick, children }: Props = $props()
</script>

<button type="button" class="chip" aria-pressed={seleccionado} {onclick}>
  {@render children()}
</button>

<style>
  .chip {
    font: inherit;
    font-size: var(--texto-s);
    font-weight: 600;
    min-height: 40px;
    padding: var(--espacio-2) var(--espacio-4);
    border-radius: var(--radio-pildora);
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    color: var(--color-tinta);
    cursor: pointer;
  }
  .chip[aria-pressed='true'] {
    background: var(--color-acento);
    border: var(--trazo) solid var(--color-tinta);
  }
</style>

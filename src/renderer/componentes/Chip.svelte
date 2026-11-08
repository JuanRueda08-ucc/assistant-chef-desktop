<script lang="ts">
  import type { Snippet } from 'svelte'

  // Opción que se marca y desmarca. Seleccionada: amarilla con el trazo de tinta (43: sin contorno al estar sin marcar).
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
    border-radius: var(--radio-boton);
    border: var(--trazo) solid transparent;
    background: var(--color-relleno);
    color: var(--color-tinta);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .chip[aria-pressed='true'] {
    background: var(--color-acento);
    border-color: var(--color-tinta);
  }
</style>

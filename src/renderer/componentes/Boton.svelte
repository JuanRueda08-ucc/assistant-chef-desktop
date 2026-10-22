<script lang="ts">
  import type { Snippet } from 'svelte'

  // Botón principal: píldora amarilla con el trazo del chef. Uno por pantalla.
  // Secundario: píldora con borde de control, para acciones de menor peso.
  interface Props {
    variante?: 'principal' | 'secundario'
    /** `submit` para el botón que envía un formulario (Intro en un campo lo pulsa). */
    tipo?: 'button' | 'submit'
    ancho?: boolean
    disabled?: boolean
    onclick?: () => void
    children: Snippet
  }
  let {
    variante = 'principal',
    tipo = 'button',
    ancho = false,
    disabled = false,
    onclick,
    children
  }: Props = $props()
</script>

<button type={tipo} class="boton {variante}" class:ancho {disabled} {onclick}>
  {@render children()}
</button>

<style>
  .boton {
    font: inherit;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-m);
    min-height: 52px;
    padding: var(--espacio-3) var(--espacio-5);
    border-radius: var(--radio-pildora);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--espacio-2);
    cursor: pointer;
  }
  .principal {
    background: var(--color-acento);
    color: var(--color-tinta);
    border: var(--trazo) solid var(--color-tinta);
    font-size: 18px;
    min-height: 58px;
  }
  .secundario {
    background: var(--color-superficie);
    color: var(--color-tinta);
    border: var(--borde) solid var(--color-borde-control);
  }
  .ancho {
    width: 100%;
  }
  .boton:disabled {
    cursor: default;
    opacity: 0.55;
  }
</style>

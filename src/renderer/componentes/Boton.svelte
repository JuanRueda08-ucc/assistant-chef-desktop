<script lang="ts">
  import type { Snippet } from 'svelte'

  // Rediseño 43: rectángulos redondeados sin contorno que se ven pulsables.
  // Principal: amarillo, uno por pantalla. Oscuro: la acción destacada de una franja amarilla.
  // Secundario: relleno suave, para acciones de menor peso.
  interface Props {
    /** `negro` y `blanco` van sobre el amarillo: no cambian con el modo oscuro (0027). */
    variante?: 'principal' | 'secundario' | 'oscuro' | 'negro' | 'blanco'
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
    padding: 0 var(--espacio-5);
    border: 0;
    border-radius: var(--radio-boton);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--espacio-2);
    line-height: 1.2;
    cursor: pointer;
    transition:
      transform var(--transicion),
      box-shadow var(--transicion),
      filter var(--transicion);
  }
  .boton:not(:disabled):hover {
    transform: translateY(-2px);
    filter: brightness(1.04);
  }
  .principal {
    background: var(--color-acento);
    color: var(--color-sobre-acento);
    box-shadow: var(--sombra-boton);
    font-size: 18px;
    min-height: 56px;
  }
  .oscuro {
    background: var(--color-tinta);
    color: var(--color-superficie);
    box-shadow: var(--sombra-boton);
  }
  .secundario {
    background: var(--color-relleno);
    color: var(--color-tinta);
  }
  .negro {
    background: var(--color-sobre-acento);
    color: var(--color-escenario);
    box-shadow: var(--sombra-boton);
    font-size: 18px;
  }
  .blanco {
    background: var(--color-pegatina);
    color: var(--color-sobre-acento);
  }
  .boton:not(:disabled):active {
    box-shadow: none;
    transform: translateY(2px);
  }
  .ancho {
    width: 100%;
  }
  /* Desactivado: sin relleno y con borde de puntos, no un amarillo apagado que parezca disponible. */
  .boton:disabled {
    cursor: default;
    background: transparent;
    box-shadow: none;
    outline: 2px dashed var(--color-borde-control);
    outline-offset: -2px;
    color: var(--color-tinta-suave);
  }
</style>

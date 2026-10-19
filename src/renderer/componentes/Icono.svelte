<script lang="ts" module>
  // Iconos de línea con trazo redondeado, a juego con el dibujo del chef (docs/diseno.md).
  const TRAZOS = {
    buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    verduras:
      '<path d="M4.5 19.5c1.5-6 4.5-10 9-12.5l3.5 3.5c-2.5 4.5-6.5 7.5-12.5 9z"/><path d="M15.5 6.5l1.5-3.5M17.5 8.5l3.5-1.5M16.5 7.5l3-3"/><path d="M9 12.5l1.5 1.5M7.5 16l1 1"/>',
    frutas:
      '<path d="M12 8c-2-1.5-6-1.5-7 2.5S6 20 9 20c1.3 0 2-.6 3-.6s1.7.6 3 .6c3 0 5-5.5 4-9.5S14 6.5 12 8z"/><path d="M12 8c0-2 1-3.5 3-4.5"/>',
    proteinas:
      '<path d="M14 4a6 6 0 0 1 6 6c0 4-4 6-7 6l-3 3a2 2 0 1 1-3-3 2 2 0 1 1 3-3l3-3c0-3 2-6 6-6"/>',
    lacteos: '<path d="M9 3h6v3l2 3v12H7V9l2-3z"/><path d="M7 13h10"/>',
    cereales:
      '<path d="M12 21V8"/><path d="M12 12c-3 0-4-2-4-4 2 0 4 1 4 4zm0 0c3 0 4-2 4-4-2 0-4 1-4 4zm0 4c-3 0-4-2-4-4 2 0 4 1 4 4zm0 0c3 0 4-2 4-4-2 0-4 1-4 4zM12 8c-1.5-1-1.5-3 0-5 1.5 2 1.5 4 0 5z"/>',
    legumbres:
      '<path d="M4 16c4 4 12 3 16-6-4-3-12-2-16 6z"/><circle cx="9" cy="14" r="1.3"/><circle cx="12.5" cy="12.5" r="1.3"/><circle cx="16" cy="11" r="1.3"/>',
    especias:
      '<path d="M8 9h8v12H8z"/><path d="M9 9V6h6v3"/><path d="M10 4h4"/><path d="M11 13h2M11 16h2"/>',
    despensa:
      '<path d="M7 7h10v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><path d="M6 4h12v3H6z"/><path d="M10 12h4"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    personas:
      '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.5 3-5 5.5-5s5 1.5 5.5 5"/><circle cx="16.5" cy="9" r="2.5"/><path d="M15 14c2.5 0 5 1 5.5 4.5"/>',
    nivel: '<path d="M7 18h10"/><path d="M8 18V11a4 4 0 1 1 3-6 4 4 0 0 1 6 4v9"/>',
    olla: '<path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M3 10h18M10 7h4"/>',
    atras: '<path d="M15 5l-7 7 7 7"/>',
    siguiente: '<path d="M9 5l7 7-7 7"/>',
    mas: '<path d="M12 6v12M6 12h12"/>',
    menos: '<path d="M6 12h12"/>',
    check: '<path d="M6 12.5l4 4 8-9"/>',
    cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
    ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    aviso: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.5"/>',
    repetir:
      '<path d="M5 12a7 7 0 0 1 12-5l2 2"/><path d="M19 4v5h-5"/><path d="M19 12a7 7 0 0 1-12 5l-2-2"/><path d="M5 20v-5h5"/>',
    tecnica:
      '<path d="M4 5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a2 2 0 0 0-2 1 2 2 0 0 0-2-1H4z"/><path d="M12 6v14"/>',
    pausa: '<path d="M9 6v12M15 6v12"/>',
    play: '<path d="M8 5l11 7-11 7z"/>'
  } as const

  export type NombreIcono = keyof typeof TRAZOS
</script>

<script lang="ts">
  interface Props {
    nombre: NombreIcono
    tamano?: number
  }
  let { nombre, tamano = 22 }: Props = $props()
</script>

<svg
  class="icono"
  width={tamano}
  height={tamano}
  viewBox="0 0 24 24"
  aria-hidden="true"
  focusable="false"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos fijos definidos arriba, sin datos del usuario -->
  {@html TRAZOS[nombre]}
</svg>

<style>
  .icono {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

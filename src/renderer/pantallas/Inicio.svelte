<script lang="ts">
  import { onMount } from 'svelte'
  import { USUARIO_LOCAL } from '@shared/types/cuenta'
  import type { ResumenReceta } from '@shared/types/ipc'
  import Boton from '../componentes/Boton.svelte'
  import hablando from '../assets/chef/chef_hablando.png'
  import DesplegableReceta from '../componentes/DesplegableReceta.svelte'
  import Icono from '../componentes/Icono.svelte'
  import { app } from '../estado/app.svelte'
  import { fotoDe } from '../lib/fotos'
  import { saludoDelChef } from '../lib/saludos'

  // Inicio, opción A «Conversación» (elegida por el autor el 2026-11-08): el chef pregunta si vamos a
  // cocinar. «Sí» lleva a la despensa; debajo, Mis recetas y hablar con el chef, del mismo tamaño.
  const usuario = $derived(app.cuenta?.usuario ?? null)
  const nombre = $derived(usuario && usuario.id !== USUARIO_LOCAL.id ? usuario.nombre : null)
  // Cambia cada vez que se entra a Inicio.
  const azar = Math.random()
  const saludo = $derived(saludoDelChef(new Date().getHours(), azar, nombre))
  const enCurso = $derived(app.sesion?.fase === 'cocinar' ? app.sesion : null)

  // Fotos para inspirarse: cuatro recetas guardadas al azar, distintas cada vez.
  let inspiracion = $state.raw<ResumenReceta[]>([])
  /** Foto pulsada: abre su desplegable (tarea 45). Otra foto lo cambia; la misma lo cierra. */
  let abierta = $state<number | null>(null)
  const fotos: HTMLButtonElement[] = []
  const recetaAbierta = $derived(abierta === null ? null : (inspiracion[abierta] ?? null))
  function alternar(n: number): void {
    abierta = abierta === n ? null : n
  }
  function cerrarDesplegable(): void {
    const n = abierta
    abierta = null
    if (n !== null) fotos[n]?.focus()
  }
  onMount(() => {
    window.api.recetas
      .listar()
      .then((recetas) => {
        inspiracion = recetas
          .filter((r) => fotoDe(r.imagen))
          .map((r) => ({ r, orden: Math.random() }))
          .sort((a, b) => a.orden - b.orden)
          .slice(0, 4)
          .map(({ r }) => r)
      })
      .catch(() => {})
  })

  // Dibujos de línea alrededor del chef, en lugar de un brillo de fondo. Fondo 2 «Más presencia»
  // (elegido por el autor el 2026-11-08): casi el doble de grandes y cada uno sobre una mancha
  // amarilla suave. Solo a los lados: nunca detrás del texto ni de los botones.
  const DIBUJOS = [
    { icono: 'verduras', x: 8, y: 6, giro: -18, tam: 102 },
    { icono: 'lacteos', x: 18, y: 28, giro: 6, tam: 76 },
    { icono: 'olla', x: 1, y: 46, giro: 8, tam: 110 },
    { icono: 'cereales', x: 11, y: 72, giro: 14, tam: 84 },
    { icono: 'frutas', x: 80, y: 6, giro: 12, tam: 95 },
    { icono: 'proteinas', x: 90, y: 24, giro: 20, tam: 80 },
    { icono: 'especias', x: 76, y: 48, giro: -10, tam: 87 },
    { icono: 'legumbres', x: 88, y: 70, giro: -14, tam: 91 }
  ] as const
</script>

<main class="inicio">
  <section class="escenario" aria-labelledby="titulo-inicio">
    <div class="dibujos" aria-hidden="true">
      {#each DIBUJOS as d, i (d.icono)}
        <span
          style:left="{d.x}%"
          style:top="{d.y}%"
          style:--giro="{d.giro}deg"
          style:animation-delay="{i * 300}ms"
          ><Icono nombre={d.icono} tamano={Math.round(d.tam * 0.7)} /></span
        >
      {/each}
    </div>
    <div class="texto">
      <h1 id="titulo-inicio" class="entra">¿Listo para<br />cocinar hoy?</h1>
      <p class="sub entra" style="--i: 1">Dime qué tienes y te ayudo a elegir, paso a paso.</p>
      <div class="acciones entra" style="--i: 2">
        <Boton variante="negro" onclick={() => app.irA('preparar')}>¡Sí, vamos!</Boton>
        <Boton variante="blanco" onclick={() => app.abrirConversacion()}
          ><Icono nombre="microfono" />Hablar con el chef</Boton
        >
        <Boton variante="blanco" onclick={() => app.abrirMisRecetas()}
          ><Icono nombre="tecnica" />Mis recetas</Boton
        >
      </div>
      {#if enCurso?.recetaAdaptada}
        <button
          type="button"
          class="en-curso entra"
          style="--i: 3"
          onclick={() => app.irA('cocinar')}
        >
          <Icono nombre="olla" />
          <span
            >Tienes a medias <b>{enCurso.recetaAdaptada.titulo}</b> · paso {enCurso.pasoActual} de {enCurso
              .recetaAdaptada.pasos.length}</span
          >
          <span class="seguir">Seguir</span>
        </button>
      {/if}
    </div>
    <div class="chef">
      <div class="circulo"></div>
      <img src={hablando} alt="" />
      <p class="globo">{saludo}</p>
    </div>
  </section>

  {#if inspiracion.length > 0}
    <section class="inspiracion" aria-labelledby="titulo-inspiracion">
      <h2 id="titulo-inspiracion">Para inspirarte hoy</h2>
      <ul>
        {#each inspiracion as r, n (r.id)}
          <li class="entra" style="--i: {n + 3}">
            <button
              type="button"
              class:activa={abierta === n}
              class:apagada={abierta !== null && abierta !== n}
              aria-expanded={abierta === n}
              aria-controls={abierta === n ? 'desplegable-receta' : undefined}
              bind:this={fotos[n]}
              onclick={() => alternar(n)}
            >
              <img src={fotoDe(r.imagen)!.url} alt="" />
              <span>{r.titulo}</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if abierta !== null && recetaAbierta}
    <DesplegableReceta receta={recetaAbierta} posicion={abierta} oncerrar={cerrarDesplegable} />
  {/if}
</main>

<style>
  .inicio {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-5);
    padding: var(--espacio-2) var(--espacio-6) var(--espacio-6);
    min-height: 0;
    overflow-y: auto;
  }
  /* El saludo en un gran bloque amarillo (0027): el amarillo manda, el blanco acompaña. */
  .escenario {
    position: relative;
    flex: 1;
    min-height: 380px;
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    align-items: center;
    padding: var(--espacio-6) clamp(32px, 4vw, 56px);
    border-radius: var(--radio-xl);
    background: var(--color-escenario);
    color: var(--color-sobre-acento);
    overflow: hidden;
    animation: aparecer-escala 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  /* Los dibujos rodean al chef, en la mitad derecha, sin cruzarse con el título. */
  .dibujos {
    position: absolute;
    inset: 0 0 0 52%;
    pointer-events: none;
  }
  .dibujos span {
    position: absolute;
    display: grid;
    opacity: 0.16;
    animation: flotar 6s ease-in-out infinite;
  }
  .dibujos :global(svg) {
    stroke-width: 1.4;
  }
  .texto {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
  }
  h1 {
    font-size: clamp(46px, 5vw, 68px);
    line-height: 1;
    letter-spacing: -0.03em;
  }
  .sub {
    margin: 0;
    font-size: 20px;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-3);
    margin-top: var(--espacio-2);
  }
  .acciones :global(.boton) {
    min-height: 58px;
  }
  .chef {
    position: relative;
    align-self: stretch;
    display: grid;
    place-items: center;
  }
  .circulo {
    position: absolute;
    width: min(380px, 32vw);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--color-escenario-circulo);
  }
  .chef img {
    position: relative;
    width: min(260px, 22vw);
    animation: respirar 3.2s ease-in-out infinite;
  }
  .globo {
    position: absolute;
    right: 4%;
    top: 6%;
    z-index: 2;
    margin: 0;
    padding: var(--espacio-2) var(--espacio-4);
    background: var(--color-pegatina);
    color: var(--color-sobre-acento);
    border: var(--trazo) solid var(--color-sobre-acento);
    border-radius: var(--radio-m) var(--radio-m) 4px var(--radio-m);
    font-weight: var(--peso-titulo);
    white-space: nowrap;
    animation: aparecer-escala 500ms 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .en-curso {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
    max-width: 560px;
    padding: var(--espacio-3) var(--espacio-4);
    font: inherit;
    text-align: left;
    color: var(--color-sobre-acento);
    background: var(--color-escenario-boton);
    border: var(--trazo) solid var(--color-sobre-acento);
    border-radius: var(--radio-boton);
    cursor: pointer;
  }
  .en-curso span:first-of-type {
    flex: 1;
  }
  .seguir {
    font-weight: var(--peso-fuerte);
    text-decoration: underline;
  }
  .inspiracion {
    position: relative;
    z-index: 5;
    display: grid;
    grid-template-columns: 130px repeat(4, 1fr);
    gap: var(--espacio-4);
    align-items: center;
  }
  .inspiracion h2 {
    font-size: var(--texto-l);
    line-height: 1.05;
  }
  .inspiracion ul {
    display: contents;
    list-style: none;
  }
  .inspiracion li {
    height: 136px;
  }
  .inspiracion button {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: var(--radio-l);
    overflow: hidden;
    font: inherit;
    color: var(--color-sobre-acento);
    background: var(--color-relleno);
    box-shadow: var(--sombra-tarjeta);
    cursor: pointer;
    transition:
      transform var(--transicion),
      box-shadow var(--transicion),
      opacity var(--transicion);
  }
  .inspiracion button:hover {
    transform: translateY(-4px) rotate(-1deg);
  }
  /* La pulsada lleva el trazo de tinta; las demás se apagan pero se pueden pulsar. */
  .inspiracion button.activa {
    box-shadow:
      0 0 0 4px var(--color-fondo),
      0 0 0 calc(4px + var(--trazo)) var(--color-tinta);
    overflow: visible;
  }
  .inspiracion button.activa img {
    border-radius: var(--radio-l);
  }
  .inspiracion button.apagada {
    opacity: 0.5;
  }
  .inspiracion img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 400ms ease;
  }
  .inspiracion button:hover img {
    transform: scale(1.06);
  }
  .inspiracion li span {
    position: absolute;
    left: var(--espacio-2);
    bottom: var(--espacio-2);
    padding: 4px var(--espacio-3);
    border-radius: var(--radio-m);
    background: var(--color-pegatina);
    font-size: var(--texto-xs);
    font-weight: var(--peso-fuerte);
  }
</style>

<script lang="ts">
  import { cubicOut } from 'svelte/easing'
  import { fly } from 'svelte/transition'
  import derecha from '../assets/chef/chef_derecha.png'
  import escuchando from '../assets/chef/chef_escuchando.png'
  import hablando from '../assets/chef/chef_hablando.png'
  import { app } from '../estado/app.svelte'

  // Bienvenida (0027): tres pasos la primera vez que una cuenta entra en este equipo. Cada paso
  // tiene su pose del chef y sus etiquetas flotando; «Saltar» la cierra en cualquier momento.
  const PASOS = [
    {
      antes: 'Cuéntame',
      resalta: 'qué tienes',
      texto:
        'Escribe o dime tus ingredientes. Yo armo tu despensa y te digo qué puedes cocinar ya.',
      imagen: hablando,
      etiquetas: ['Tomate', 'Huevo', 'Arroz']
    },
    {
      antes: 'Te propongo',
      resalta: 'recetas',
      texto:
        'Recetas guardadas o ideas nuevas, con lo que te falta a la vista y respetando tus alergias.',
      imagen: derecha,
      etiquetas: ['30 min', 'Fácil', 'Para 2']
    },
    {
      antes: 'Te guío',
      resalta: 'paso a paso',
      texto:
        'Con temporizadores y con voz: dime «listo» o «siguiente» y seguimos, con las manos ocupadas.',
      imagen: escuchando,
      etiquetas: ['«Listo»', '«Siguiente»', '⏱ 5:00']
    }
  ] as const

  let paso = $state(0)
  const actual = $derived(PASOS[paso]!)
  const ultimo = $derived(paso === PASOS.length - 1)
  let siguiente: HTMLButtonElement | undefined = $state()
  $effect(() => {
    void paso
    siguiente?.focus()
  })

  function avanzar(): void {
    if (ultimo) app.terminarBienvenida()
    else paso++
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'ArrowRight') avanzar()
    if (e.key === 'ArrowLeft' && paso > 0) paso--
  }}
/>

<main class="bienvenida" aria-labelledby="titulo-bienvenida">
  {#key paso}
    <section class="izq" in:fly={{ x: 40, duration: 450, easing: cubicOut }}>
      <span class="paso">Paso {paso + 1} de {PASOS.length}</span>
      <h1 id="titulo-bienvenida">
        {actual.antes}<br /><span class="resalta">{actual.resalta}</span>
      </h1>
      <p>{actual.texto}</p>
    </section>
    <div class="der" aria-hidden="true" in:fly={{ y: 30, duration: 500, easing: cubicOut }}>
      <div class="circulo"></div>
      <div class="figura"><img src={actual.imagen} alt="" /></div>
      {#each actual.etiquetas as etiqueta, i (etiqueta)}
        <span class="etiqueta e{i}">{etiqueta}</span>
      {/each}
    </div>
  {/key}

  <footer class="pie">
    <div class="puntos" aria-hidden="true">
      {#each PASOS.keys() as i (i)}<i class:actual={i === paso}></i>{/each}
    </div>
    <div class="botones">
      {#if paso > 0}
        <button type="button" class="atras" onclick={() => paso--}>← Atrás</button>
      {/if}
      <button type="button" class="seguir" bind:this={siguiente} onclick={avanzar}
        >{ultimo ? '¡A cocinar!' : 'Siguiente →'}</button
      >
      {#if !ultimo}
        <button type="button" class="saltar" onclick={() => app.terminarBienvenida()}>Saltar</button
        >
      {/if}
    </div>
  </footer>
</main>

<style>
  .bienvenida {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    background: var(--color-escenario);
    color: var(--color-sobre-acento);
    overflow: hidden;
  }
  .izq {
    grid-column: 1;
    grid-row: 1;
    align-self: center;
    padding: 0 0 0 clamp(32px, 6vw, 88px);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-5);
    position: relative;
    z-index: 2;
  }
  .paso {
    font-weight: var(--peso-titulo);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: var(--texto-s);
  }
  h1 {
    font-size: clamp(52px, 6.4vw, 84px);
    line-height: 1.08;
    letter-spacing: -0.03em;
  }
  /* La palabra resaltada es un bloque propio: no pisa la línea de arriba. */
  .resalta {
    display: inline-block;
    margin-top: 0.12em;
    padding: 0.04em 0.22em 0.1em;
    line-height: 1;
    border-radius: 0.22em;
    background: var(--color-sobre-acento);
    color: var(--color-escenario);
    transform: rotate(-1.5deg);
  }
  .izq p {
    margin: 0;
    font-size: 21px;
    line-height: 1.5;
    max-width: 30ch;
  }
  .der {
    grid-column: 2;
    grid-row: 1 / 3;
    position: relative;
  }
  .circulo {
    position: absolute;
    width: min(620px, 52vw);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--color-escenario-circulo);
    left: 4%;
    top: 50%;
    transform: translateY(-50%);
  }
  /* La posición va en el contenedor; la imagen solo «respira», sin pisar el centrado. */
  .figura {
    position: absolute;
    left: calc(4% + min(310px, 26vw));
    top: 50%;
    transform: translate(-50%, -50%);
  }
  .figura img {
    display: block;
    width: min(360px, 28vw);
    animation: respirar 3s ease-in-out infinite;
  }
  .etiqueta {
    position: absolute;
    padding: 10px 18px;
    border-radius: var(--radio-pildora);
    border: 3px solid var(--color-sobre-acento);
    background: var(--color-pegatina);
    color: var(--color-sobre-acento);
    font-weight: var(--peso-titulo);
    font-size: var(--texto-m);
    box-shadow: 0 6px 0 var(--color-sobre-acento);
    animation: flotar 3.2s ease-in-out infinite;
  }
  .e0 {
    --giro: -8deg;
    left: 2%;
    top: 20%;
  }
  .e1 {
    --giro: 7deg;
    right: 10%;
    top: 16%;
    animation-delay: 400ms;
  }
  .e2 {
    --giro: -5deg;
    left: 6%;
    bottom: 16%;
    animation-delay: 800ms;
  }
  .pie {
    grid-column: 1;
    grid-row: 2;
    padding: 0 0 clamp(32px, 6vh, 56px) clamp(32px, 6vw, 88px);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-5);
    position: relative;
    z-index: 2;
  }
  .puntos {
    display: flex;
    gap: 8px;
  }
  .puntos i {
    width: 12px;
    height: 12px;
    border-radius: var(--radio-pildora);
    background: var(--color-escenario-tenue);
    transition: width var(--transicion);
  }
  .puntos i.actual {
    width: 40px;
    background: var(--color-sobre-acento);
  }
  .botones {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
  }
  button {
    font: inherit;
    cursor: pointer;
    border: 0;
  }
  .seguir,
  .atras {
    min-height: 56px;
    padding: 0 var(--espacio-5);
    border-radius: var(--radio-boton);
    font-weight: var(--peso-titulo);
    font-size: var(--texto-m);
    transition: transform var(--transicion);
  }
  .seguir {
    background: var(--color-sobre-acento);
    color: var(--color-escenario);
    box-shadow: var(--sombra-boton);
  }
  .atras {
    background: var(--color-escenario-boton);
    color: var(--color-sobre-acento);
  }
  .seguir:hover,
  .atras:hover {
    transform: translateY(-2px);
  }
  .seguir:active,
  .atras:active {
    transform: translateY(1px);
  }
  .saltar {
    background: none;
    color: var(--color-sobre-acento);
    font-weight: var(--peso-titulo);
    text-decoration: underline;
    padding: var(--espacio-2);
  }
  button:focus-visible {
    outline: 3px solid var(--color-sobre-acento);
    outline-offset: 3px;
  }
</style>

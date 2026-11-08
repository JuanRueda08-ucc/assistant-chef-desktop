<script lang="ts">
  import { NOMBRE_DIFICULTAD } from '@shared/textos'
  import Boton from '../componentes/Boton.svelte'
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import Globo from '../componentes/Globo.svelte'
  import Icono from '../componentes/Icono.svelte'
  import RecetaGeneradaVista from '../componentes/RecetaGeneradaVista.svelte'
  import { app } from '../estado/app.svelte'

  // Las recetas de la IA que guardó la cuenta: una lista y la elegida, con una acción para empezar.
  const elegida = $derived(
    app.misRecetas.find((g) => g.receta.id === app.miRecetaElegidaId) ?? app.misRecetas[0] ?? null
  )
  let confirmando = $state(false)
  $effect(() => {
    void elegida?.receta.id
    confirmando = false
  })
</script>

<main class="mis-recetas">
  {#if elegida}
    <section class="lista" aria-labelledby="titulo-mis-recetas">
      <h1 id="titulo-mis-recetas">Mis recetas</h1>
      <ul class="opciones">
        {#each app.misRecetas as { receta } (receta.id)}
          <li>
            <button
              type="button"
              aria-current={receta.id === elegida.receta.id ? 'true' : undefined}
              onclick={() => (app.miRecetaElegidaId = receta.id)}
            >
              <span class="nombre">{receta.titulo}</span>
              <span class="datos">
                <span><Icono nombre="reloj" tamano={16} />{receta.tiempoTotalMin} min</span>
                <span>{NOMBRE_DIFICULTAD[receta.dificultad]}</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
      <Boton variante="secundario" onclick={() => app.cerrarMisRecetas()}>Volver</Boton>
    </section>

    <article class="detalle" aria-labelledby="titulo-mi-receta">
      <div class="contenido">
        <p class="marca">Receta generada · guardada por ti</p>
        <h2 id="titulo-mi-receta">{elegida.receta.titulo}</h2>
        <p class="descripcion">{elegida.receta.descripcion}</p>
        <RecetaGeneradaVista generada={elegida} />
      </div>
      <footer class="pie">
        {#if app.error}<p class="error" role="alert">{app.error}</p>{/if}
        {#if confirmando}
          <p class="nota">¿Quitarla de Mis recetas? No se puede deshacer.</p>
          <Boton variante="secundario" onclick={() => (confirmando = false)}>No</Boton>
          <Boton
            variante="secundario"
            disabled={app.ocupado}
            onclick={() => app.quitarDeMisRecetas(elegida.receta.id)}>Sí, quitar</Boton
          >
        {:else}
          <Boton variante="secundario" onclick={() => (confirmando = true)}>Quitar</Boton>
          <Boton disabled={app.ocupado} onclick={() => app.cocinar(elegida.receta.id)}
            >Cocinar esta receta</Boton
          >
        {/if}
      </footer>
    </article>
  {:else}
    <section class="vacia">
      <ChefBlob pose="busto" tamano={140} />
      <Globo cola="izquierda">
        <h1>Aún no tienes recetas guardadas</h1>
        <p>Cuando termines de cocinar una receta del chef, podrás guardarla aquí.</p>
      </Globo>
      <Boton onclick={() => app.cerrarMisRecetas()}>Volver</Boton>
    </section>
  {/if}
</main>

<style>
  .mis-recetas {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: var(--espacio-5);
    padding: var(--espacio-1) var(--espacio-6) var(--espacio-6);
    min-height: 0;
  }
  .lista {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
    min-height: 0;
  }
  h1 {
    font-size: 26px;
  }
  h2 {
    font-size: var(--texto-xl);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .opciones {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px;
  }
  .opciones button {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--espacio-3) var(--espacio-4);
    font: inherit;
    text-align: left;
    color: var(--color-tinta);
    background: var(--color-superficie);
    border: var(--borde) solid var(--color-borde-control);
    border-radius: var(--radio-m);
    cursor: pointer;
  }
  .opciones button[aria-current='true'] {
    background: var(--color-acento-suave);
    border: var(--trazo) solid var(--color-tinta);
  }
  .nombre {
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-m);
  }
  .datos {
    display: flex;
    gap: var(--espacio-3);
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
  }
  .datos span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .detalle {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--color-superficie);
    border: var(--borde) solid var(--color-separador);
    border-radius: var(--radio-xl);
    overflow: hidden;
  }
  .contenido {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--espacio-5) var(--espacio-6);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
  }
  .marca,
  .nota {
    margin: 0;
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
  }
  .descripcion {
    margin: 0;
    color: var(--color-tinta-suave);
    line-height: 1.45;
    max-width: 60ch;
  }
  .pie {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--espacio-4);
    padding: var(--espacio-4) var(--espacio-6);
    border-top: var(--borde) solid var(--color-separador);
  }
  .error {
    margin: 0 auto 0 0;
    padding-left: var(--espacio-3);
    border-left: 4px solid var(--color-acento);
    font-size: var(--texto-s);
  }
  .vacia {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--espacio-5);
    max-width: 640px;
    margin: 0 auto;
    text-align: center;
  }
  .vacia h1 {
    font-size: var(--texto-xl);
  }
  .vacia p {
    margin: var(--espacio-2) 0 0;
    color: var(--color-tinta-suave);
  }
</style>

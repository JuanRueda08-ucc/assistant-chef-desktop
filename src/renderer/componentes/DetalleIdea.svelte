<script lang="ts">
  import { NOMBRE_DIFICULTAD } from '@shared/textos'
  import type { FuenteIdea, FuenteWeb, IdeaReceta } from '@shared/types/ideas'
  import Boton from './Boton.svelte'
  import Icono from './Icono.svelte'

  // Detalle de una idea del chef. Lo que tienes, lo que falta y lo que no se puede verificar lo
  // calcula el código (recetas/ideas.ts). La receta completa llega en la tarea 40.
  interface Props {
    idea: IdeaReceta
    fuente: FuenteIdea
    fuentes: FuenteWeb[]
    sugerenciasBusqueda: string | null
    tieneAlergias: boolean
  }
  let { idea, fuente, fuentes, sugerenciasBusqueda, tieneAlergias }: Props = $props()
</script>

<article class="idea" aria-labelledby="titulo-idea">
  <div class="contenido">
    <p class="marca">Idea del chef · generada por IA</p>
    <h2 id="titulo-idea">{idea.titulo}</h2>
    <p class="descripcion">{idea.descripcion}</p>

    <ul class="datos" aria-label="Datos de la idea">
      <li><Icono nombre="reloj" tamano={18} />Unos {idea.tiempoTotalMin} min</li>
      <li><Icono nombre="nivel" tamano={18} />{NOMBRE_DIFICULTAD[idea.dificultad]}</li>
    </ul>

    {#if idea.sinVerificar.length > 0}
      <p class="sin-verificar" role="status">
        Alérgenos sin verificar: {idea.sinVerificar.join(', ')}. No puedo confirmar que encaje con
        tus alergias o tu dieta; revisa sus etiquetas{tieneAlergias
          ? ', sobre todo por tus alergias'
          : ''}.
      </p>
    {/if}

    <div class="columnas">
      <section aria-labelledby="titulo-tienes">
        <h3 id="titulo-tienes">Lo tienes ({idea.tienes.length})</h3>
        <ul class="lista">
          {#each idea.tienes as nombre (nombre)}<li>{nombre}</li>{/each}
        </ul>
      </section>
      <section aria-labelledby="titulo-faltan">
        <h3 id="titulo-faltan">Te falta ({idea.faltan.length})</h3>
        {#if idea.faltan.length > 0}
          <ul class="lista">
            {#each idea.faltan as nombre (nombre)}<li>{nombre}</li>{/each}
          </ul>
        {:else}
          <p class="nota">Tienes todo.</p>
        {/if}
      </section>
    </div>

    <section class="origen" aria-labelledby="titulo-origen">
      <h3 id="titulo-origen">De dónde sale</h3>
      {#if fuente === 'internet'}
        <p class="nota">El chef buscó en internet para proponerla.</p>
        {#if fuentes.length > 0}
          <ul class="fuentes">
            {#each fuentes as f (f.url)}
              <li><a href={f.url} target="_blank" rel="noreferrer">{f.titulo}</a></li>
            {/each}
          </ul>
        {/if}
        {#if sugerenciasBusqueda}
          <!-- Los términos de Google exigen mostrarlas tal cual. Sin scripts ni acceso a la app. -->
          <iframe
            class="sugerencias"
            title="Sugerencias de búsqueda de Google"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcdoc={sugerenciasBusqueda}
          ></iframe>
        {/if}
      {:else}
        <p class="nota">Creada por el chef, sin buscar en internet.</p>
      {/if}
    </section>
  </div>

  <footer class="pie">
    <p class="nota">La receta paso a paso de las ideas estará disponible pronto.</p>
    <Boton disabled>Cocinar esta idea</Boton>
  </footer>
</article>

<style>
  .idea {
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
  h2 {
    font-size: var(--texto-xl);
  }
  h3 {
    margin: 0 0 var(--espacio-2);
    font-family: var(--fuente-titulo);
    font-size: var(--texto-m);
  }
  .descripcion {
    margin: 0;
    color: var(--color-tinta-suave);
    line-height: 1.45;
    max-width: 60ch;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .datos {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .datos li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px var(--espacio-3);
    border-radius: var(--radio-pildora);
    background: var(--color-acento);
    border: var(--borde) solid var(--color-tinta);
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
  }
  .sin-verificar {
    margin: 0;
    padding: var(--espacio-3) var(--espacio-4);
    border: var(--borde) dashed var(--color-tinta);
    border-radius: var(--radio-m);
    background: var(--color-acento-suave);
    font-size: var(--texto-s);
    font-weight: 600;
  }
  .columnas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--espacio-5);
  }
  .lista li {
    padding: var(--espacio-1) 0;
    border-bottom: var(--borde) solid var(--color-separador);
    overflow-wrap: anywhere;
  }
  .fuentes {
    margin-top: var(--espacio-2);
    font-size: var(--texto-s);
  }
  .fuentes a {
    color: var(--color-tinta);
    overflow-wrap: anywhere;
  }
  .sugerencias {
    width: 100%;
    height: 72px;
    margin-top: var(--espacio-2);
    border: 0;
  }
  .pie {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--espacio-4);
    padding: var(--espacio-4) var(--espacio-6);
    border-top: var(--borde) solid var(--color-separador);
  }
</style>

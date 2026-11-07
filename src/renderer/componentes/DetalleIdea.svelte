<script lang="ts">
  import { escalarReceta } from '@shared/recetas/escalado'
  import { indexar, ingredientesSinVerificar } from '@shared/recetas/etiquetas'
  import {
    estadoIngredienteGenerado,
    type EstadoIngredienteGenerado
  } from '@shared/recetas/receta-generada'
  import { NOMBRE_ALERGENO, NOMBRE_DIFICULTAD } from '@shared/textos'
  import type { FuenteIdea, FuenteWeb, IdeaReceta } from '@shared/types/ideas'
  import { app } from '../estado/app.svelte'
  import { describirIngrediente } from '../lib/medidas'
  import Boton from './Boton.svelte'
  import Icono from './Icono.svelte'

  // Detalle de una idea del chef. Lo que tienes, lo que falta y lo que no se puede verificar lo
  // calcula el código (recetas/ideas.ts). Al pedirla, muestra la receta completa ya comprobada.
  interface Props {
    idea: IdeaReceta
    fuente: FuenteIdea
    fuentes: FuenteWeb[]
    sugerenciasBusqueda: string | null
    tieneAlergias: boolean
  }
  let { idea, fuente, fuentes, sugerenciasBusqueda, tieneAlergias }: Props = $props()

  const ETIQUETA_ESTADO: Record<EstadoIngredienteGenerado, string> = {
    tienes: 'Lo tienes',
    basico: 'Básico',
    falta: 'Falta',
    opcional: 'Opcional'
  }
  const generada = $derived(app.recetasDeIdeas[idea.id] ?? null)
  const generando = $derived(app.ideaGenerandoId === idea.id)
  const catalogo = $derived([...app.catalogo, ...(generada?.ingredientesNuevos ?? [])])
  const receta = $derived(
    generada ? escalarReceta(generada.receta, app.preferencias.porciones).receta : null
  )
  const sinVerificar = $derived(
    receta ? ingredientesSinVerificar(receta, catalogo) : idea.sinVerificar
  )
  const ingredientes = $derived.by(() => {
    if (!receta) return []
    const porId = indexar(catalogo)
    return receta.ingredientes.map((ir) => {
      const ingrediente = porId.get(ir.ingredienteId)
      return {
        id: ir.id,
        estado: estadoIngredienteGenerado(ir, ingrediente, app.preferencias),
        ...describirIngrediente({
          cantidad: ir.cantidad,
          unidad: ir.unidad,
          ingrediente,
          idIngrediente: ir.ingredienteId,
          preparacion: ir.preparacion
        })
      }
    })
  })
</script>

<article class="idea" aria-labelledby="titulo-idea">
  <div class="contenido">
    <p class="marca">{receta ? 'Receta generada' : 'Idea del chef · generada por IA'}</p>
    <h2 id="titulo-idea">{idea.titulo}</h2>
    <p class="descripcion">{idea.descripcion}</p>

    <ul class="datos" aria-label="Datos de la idea">
      <li>
        <Icono nombre="reloj" tamano={18} />{receta
          ? `${receta.tiempoTotalMin} min`
          : `Unos ${idea.tiempoTotalMin} min`}
      </li>
      {#if receta}
        <li>
          <Icono nombre="personas" tamano={18} />{receta.porcionesBase}
          {receta.porcionesBase === 1 ? 'porción' : 'porciones'}
        </li>
      {/if}
      <li>
        <Icono nombre="nivel" tamano={18} />{NOMBRE_DIFICULTAD[(receta ?? idea).dificultad]}
      </li>
    </ul>

    {#if receta?.alergenos.length}
      <ul class="etiquetas" aria-label="Alérgenos">
        {#each receta.alergenos as a (a)}
          <li>Contiene {NOMBRE_ALERGENO[a].toLocaleLowerCase('es')}</li>
        {/each}
      </ul>
    {/if}

    {#if sinVerificar.length > 0}
      <p class="sin-verificar" role="status">
        Alérgenos sin verificar: {sinVerificar.join(', ')}. No puedo confirmar que encaje con tus
        alergias o tu dieta; revisa sus etiquetas{tieneAlergias
          ? ', sobre todo por tus alergias'
          : ''}.
      </p>
    {/if}

    {#if receta}
      <p class="aviso-ia">
        La escribió una IA y nadie la ha revisado. Vigila los tiempos y el punto de cocción, y
        cocina bien la carne, el pescado y el huevo.
      </p>
      <section aria-labelledby="titulo-ingredientes-idea">
        <h3 id="titulo-ingredientes-idea">Ingredientes</h3>
        <ul class="ingredientes">
          {#each ingredientes as ing (ing.id)}
            <li>
              <span class="estado" class:falta={ing.estado === 'falta'}
                >{ETIQUETA_ESTADO[ing.estado]}</span
              >
              <span><b>{ing.nombre}</b> <small>{ing.detalle}</small></span>
            </li>
          {/each}
        </ul>
      </section>
      <section aria-labelledby="titulo-pasos-idea">
        <h3 id="titulo-pasos-idea">Pasos</h3>
        <ol class="pasos">
          {#each receta.pasos as paso (paso.id)}<li>{paso.texto}</li>{/each}
        </ol>
      </section>
    {:else}
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
    {/if}

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
    {#if app.recetaIdeaError || app.error}
      <p class="error" role="alert">{app.recetaIdeaError ?? app.error}</p>
    {/if}
    {#if fuente === 'internet'}
      <!-- Antes hay que resolver las condiciones de Google (plan-chef-recetas.md). -->
      <p class="nota">Las recetas de ideas encontradas en internet aún no están disponibles.</p>
      <Boton disabled>Ver receta completa</Boton>
    {:else if generada}
      <Boton disabled={app.ocupado} onclick={() => app.cocinar(generada.receta.id)}
        >Cocinar esta receta</Boton
      >
    {:else}
      <p class="nota" aria-live="polite">
        {generando ? 'El chef está escribiendo la receta. Puede tardar un minuto.' : ''}
      </p>
      <Boton disabled={app.ideaGenerandoId !== null} onclick={() => app.generarRecetaDeIdea(idea)}>
        {generando ? 'Escribiendo…' : 'Ver receta completa'}
      </Boton>
    {/if}
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
  .aviso-ia {
    margin: 0;
    padding-left: var(--espacio-3);
    border-left: 4px solid var(--color-acento);
    font-size: var(--texto-s);
  }
  .etiquetas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .etiquetas li {
    padding: 6px 12px;
    border: var(--borde) dashed var(--color-tinta);
    border-radius: var(--radio-pildora);
    font-size: var(--texto-xs);
    font-weight: 600;
  }
  .ingredientes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--espacio-2) var(--espacio-4);
  }
  .ingredientes li {
    display: flex;
    align-items: flex-start;
    gap: var(--espacio-3);
    padding: var(--espacio-2) 0;
    border-bottom: var(--borde) solid var(--color-separador);
  }
  .ingredientes small {
    display: block;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }
  .estado {
    flex: none;
    min-width: 76px;
    padding: 3px 8px;
    border: var(--borde) solid var(--color-borde-control);
    border-radius: var(--radio-pildora);
    font-size: var(--texto-xs);
    font-weight: var(--peso-fuerte);
    text-align: center;
  }
  .estado.falta {
    background: var(--color-tinta);
    border-color: var(--color-tinta);
    color: var(--color-superficie);
  }
  .pasos {
    margin: 0;
    padding-left: var(--espacio-5);
    line-height: 1.45;
  }
  .pasos li {
    padding: var(--espacio-1) 0;
  }
  .error {
    margin: 0 auto 0 0;
    padding-left: var(--espacio-3);
    border-left: 4px solid var(--color-acento);
    font-size: var(--texto-s);
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

<script lang="ts">
  import { escalarReceta } from '@shared/recetas/escalado'
  import { recuentoDisponibilidad } from '@shared/recetas/disponibilidad'
  import {
    estadoIngredienteGenerado,
    ingredientesConLibres,
    type EstadoIngredienteGenerado
  } from '@shared/recetas/receta-generada'
  import { NOMBRE_ALERGENO, NOMBRE_DIETA, NOMBRE_DIFICULTAD, NOMBRE_EQUIPO } from '@shared/textos'
  import type { Receta } from '@shared/types/receta'
  import Boton from '../componentes/Boton.svelte'
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import DetalleIdea from '../componentes/DetalleIdea.svelte'
  import Globo from '../componentes/Globo.svelte'
  import Icono from '../componentes/Icono.svelte'
  import { app } from '../estado/app.svelte'
  import { describirIngrediente } from '../lib/medidas'
  import { unirLista } from '@shared/recetas/lista'

  // Elegir (rediseño 43): tarjetas para comparar de un vistazo y, arriba, pedir ideas al chef. Al
  // pulsar una tarjeta se abre su detalle, con una sola acción para empezar.
  const resultados = $derived(app.busqueda?.resultados ?? [])

  const actual = $derived(
    resultados.find((r) => r.receta.id === app.recetaVisibleId) ?? resultados[0]
  )
  const ideas = $derived(app.ideas?.lista ?? [])
  const ideaActual = $derived(ideas.find((i) => i.id === app.ideaVisibleId) ?? null)
  const hayContenido = $derived(
    resultados.length > 0 || ideas.length > 0 || app.ideasCargando || !!app.ideasError
  )
  const enDetalle = $derived(app.elegirDetalle && (!!ideaActual || !!actual))
  // Con qué se buscó, en palabras: sustituye a contar resultados y motivos.
  const conQue = $derived(
    unirLista([
      ...app.catalogo
        .filter((i) => !i.esBasicoDespensa && app.preferencias.ingredientes.includes(i.id))
        .map((i) => i.nombre.toLocaleLowerCase('es')),
      ...app.preferencias.ingredientesSinIdentificar
    ])
  )
  function verReceta(id: string): void {
    app.ideaVisibleId = null
    app.recetaVisibleId = id
    app.elegirDetalle = true
  }
  function verIdea(id: string): void {
    app.ideaVisibleId = id
    app.elegirDetalle = true
  }
  const porciones = $derived(app.preferencias.porciones)

  // Receta completa de la elegida, para mostrar todos sus ingredientes ya escalados.
  // Caché sin reactividad: solo evita pedir dos veces la misma receta.
  const recetas: Record<string, Receta | null> = {}
  // `raw`: sin proxy, porque escalarReceta la copia con structuredClone y un proxy no se puede copiar.
  let recetaActual = $state.raw<Receta | null>(null)
  $effect(() => {
    const id = actual?.receta.id
    if (!id) return
    if (id in recetas) {
      recetaActual = recetas[id] ?? null
      return
    }
    recetaActual = null
    window.api.recetas.obtener(id).then((r) => {
      recetas[id] = r
      if (actual?.receta.id === id) recetaActual = r
    })
  })
  const escalada = $derived(recetaActual ? escalarReceta(recetaActual, porciones).receta : null)
  const disponibilidad = $derived(
    recetaActual
      ? recuentoDisponibilidad(
          recetaActual,
          ingredientesConLibres(app.preferencias),
          app.catalogoCompleto
        )
      : null
  )

  const ingredientes = $derived.by(() => {
    if (!escalada || !actual) return []
    const faltan = new Map(actual.faltantes.map((f) => [f.ingredienteId, f]))
    return escalada.ingredientes.map((ir) => {
      const catalogo = app.catalogoCompleto.find((i) => i.id === ir.ingredienteId)
      const faltante = faltan.get(ir.ingredienteId)
      const estado: EstadoIngredienteGenerado = faltante
        ? 'falta'
        : estadoIngredienteGenerado(ir, catalogo, app.preferencias)
      return {
        id: ir.id,
        estado,
        sustituciones: faltante?.sustituciones ?? [],
        ...describirIngrediente({
          cantidad: ir.cantidad,
          unidad: ir.unidad,
          ingrediente: catalogo,
          idIngrediente: ir.ingredienteId,
          preparacion: null
        })
      }
    })
  })
  const ETIQUETA_ESTADO: Record<EstadoIngredienteGenerado, string> = {
    tienes: 'Lo tienes',
    basico: 'Básico',
    falta: 'Falta',
    opcional: 'Opcional'
  }
</script>

<main class="elegir" class:detalle-abierto={enDetalle}>
  {#if !enDetalle}
    <div class="rejilla-vista">
      <div class="titulo-fila">
        <div>
          <button type="button" class="volver" onclick={() => app.irA('preparar')}
            ><Icono nombre="atras" tamano={16} />Cambiar ingredientes</button
          >
          <h1>¿Qué cocinamos?</h1>
        </div>
        {#if conQue}<p class="con-que">Con {conQue}</p>{/if}
      </div>

      <section class="ideas" aria-labelledby="titulo-ideas" aria-live="polite">
        <ChefBlob pose="hablando" tamano={96} />
        <div>
          <h2 id="titulo-ideas">
            {app.ideasCargando
              ? 'El chef está pensando…'
              : ideas.length > 0
                ? 'Ideas del chef'
                : resultados.length > 0
                  ? '¿Ninguna te convence?'
                  : 'No hay recetas guardadas con esto'}
          </h2>
          <p>
            {#if app.ideasError}{app.ideasError}{:else if ideas.length > 0}Recetas nuevas con lo que
              tienes, {app.ideas?.fuente === 'internet'
                ? 'buscadas en internet'
                : 'creadas sin buscar en internet'}.{:else}El chef inventa recetas con lo que
              tienes.{/if}
          </p>
        </div>
        <Boton variante="oscuro" disabled={app.ideasCargando} onclick={() => app.proponerIdeas()}>
          <Icono nombre="chispa" />{ideas.length > 0 ? 'Dame otras' : 'Pedir ideas al chef'}
        </Boton>
      </section>

      {#if hayContenido}
        <ul class="rejilla" aria-label="Recetas">
          {#each ideas as idea (idea.id)}
            <li>
              <button type="button" class="tarjeta idea" onclick={() => verIdea(idea.id)}>
                <span class="foto"><ChefBlob pose="hablando" tamano={92} /></span>
                <span class="cuerpo">
                  <span class="nombre">{idea.titulo}</span>
                  <span class="datos">
                    <span><Icono nombre="reloj" tamano={16} />{idea.tiempoTotalMin} min</span>
                    <span>Idea del chef</span>
                  </span>
                  <span class="faltan" class:completa={idea.faltan.length === 0}
                    >{idea.faltan.length === 0
                      ? 'Tienes todo'
                      : `Te ${idea.faltan.length === 1 ? 'falta' : 'faltan'} ${idea.faltan.length}`}</span
                  >
                </span>
              </button>
            </li>
          {/each}
          {#each resultados as r, n (r.receta.id)}
            <li>
              <button type="button" class="tarjeta" onclick={() => verReceta(r.receta.id)}>
                <span class="foto">
                  {#if r.receta.imagen}<img src={r.receta.imagen} alt="" />{:else}<span
                      class="comida variante-{n % 3}"
                    ></span>{/if}
                </span>
                <span class="cuerpo">
                  <span class="nombre">{r.receta.titulo}</span>
                  {#if r.receta.origen === 'generada'}<small class="sin-revisar"
                      >De Mis recetas</small
                    >{:else if r.receta.estadoRevision === 'borrador'}<small class="sin-revisar"
                      >Sin revisar</small
                    >{/if}
                  <span class="datos">
                    <span><Icono nombre="reloj" tamano={16} />{r.receta.tiempoTotalMin} min</span>
                    <span
                      ><Icono nombre="nivel" tamano={16} />{NOMBRE_DIFICULTAD[
                        r.receta.dificultad
                      ]}</span
                    >
                  </span>
                  <span class="faltan" class:completa={r.faltantes.length === 0}
                    >{r.faltantes.length === 0
                      ? 'Tienes todo'
                      : `Te ${r.faltantes.length === 1 ? 'falta' : 'faltan'} ${r.faltantes.length}`}</span
                  >
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    <button type="button" class="volver" onclick={() => (app.elegirDetalle = false)}
      ><Icono nombre="atras" tamano={16} />Todas las recetas</button
    >
    {#if ideaActual && app.ideas}
      <DetalleIdea
        idea={ideaActual}
        fuente={app.ideas.fuente}
        fuentes={app.ideas.fuentes}
        sugerenciasBusqueda={app.ideas.sugerenciasBusqueda}
        tieneAlergias={app.preferencias.alergias.length > 0}
      />
    {:else if actual}
      <article class="detalle" aria-labelledby="titulo-receta">
        <div class="contenido">
          <header class="cabeza">
            <div class="plato" aria-hidden={actual.receta.imagen ? undefined : 'true'}>
              {#if actual.receta.imagen}
                <img src={actual.receta.imagen} alt="" />
              {:else}
                <div class="comida"></div>
              {/if}
            </div>
            <div>
              {#if actual.receta.origen === 'generada'}
                <p class="aviso-foto">Receta generada · guardada por ti</p>
              {/if}
              <h2 id="titulo-receta">{actual.receta.titulo}</h2>
              <p class="descripcion">{actual.receta.descripcion}</p>
              {#if !actual.receta.imagen && actual.receta.origen !== 'generada'}<p
                  class="aviso-foto"
                >
                  Foto pendiente
                </p>{/if}
            </div>
          </header>

          <ul class="datos-receta" aria-label="Datos de la receta">
            <li><Icono nombre="reloj" tamano={18} />{actual.receta.tiempoTotalMin} min</li>
            <li>
              <Icono nombre="personas" tamano={18} />{porciones}
              {porciones === 1 ? 'porción' : 'porciones'}
            </li>
            <li>
              <Icono nombre="nivel" tamano={18} />{NOMBRE_DIFICULTAD[actual.receta.dificultad]}
            </li>
            {#if actual.receta.equipo.length}
              <li>
                <Icono nombre="olla" tamano={18} />{actual.receta.equipo
                  .map((e) => NOMBRE_EQUIPO[e])
                  .join(', ')}
              </li>
            {/if}
          </ul>
          {#if actual.receta.dietas.length || actual.receta.alergenos.length}
            <ul class="etiquetas">
              {#each actual.receta.dietas as d (d)}<li>{NOMBRE_DIETA[d]}</li>{/each}
              {#each actual.receta.alergenos as a (a)}<li class="alerta">
                  Contiene {NOMBRE_ALERGENO[a].toLocaleLowerCase('es')}
                </li>{/each}
            </ul>
          {/if}

          {#if actual.receta.origen === 'generada'}
            <p class="sin-verificar">
              La escribió una IA y nadie la ha revisado. Vigila los tiempos y el punto de cocción, y
              cocina bien la carne, el pescado y el huevo.
            </p>
          {/if}

          {#if actual.ingredientesSinVerificar.length > 0}
            <p class="sin-verificar" role="status">
              Alérgenos sin verificar: {actual.ingredientesSinVerificar.join(', ')}. Revisa sus
              etiquetas{app.preferencias.alergias.length > 0
                ? ', sobre todo por tus alergias'
                : ''}.
            </p>
          {/if}

          {#if app.globo}
            <div class="chef">
              <ChefBlob pose="busto" tamano={56} />
              <Globo cola="izquierda"><p>{app.globo}</p></Globo>
            </div>
          {/if}

          <section class="ingredientes" aria-labelledby="titulo-ingredientes">
            <div class="fila">
              <h3 id="titulo-ingredientes">Ingredientes</h3>
              <p class="cobertura">
                {actual.ingredientesObligatorios - actual.faltantes.length} de {actual.ingredientesObligatorios}
                disponibles
                {#if disponibilidad}
                  {`(${disponibilidad.seleccionados} tuyos${disponibilidad.basicos.length ? ` + ${disponibilidad.basicos.length} básicos` : ''})`}
                {/if}
              </p>
            </div>
            {#if ingredientes.length}
              <ul class="lista">
                {#each ingredientes as ing (ing.id)}
                  <li class={ing.estado}>
                    <span class="estado">{ETIQUETA_ESTADO[ing.estado]}</span>
                    <span class="texto">
                      <b>{ing.nombre}</b>
                      <small>{ing.detalle}</small>
                      {#each ing.sustituciones as s (s.sustitucionId)}
                        <small class="sustitucion"
                          >Puedes usar {s.nombreDestino.toLocaleLowerCase('es')}</small
                        >
                      {/each}
                    </span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="cargando">Cargando ingredientes…</p>
            {/if}
          </section>
        </div>

        <footer class="pie">
          {#if app.error}<p class="error" role="alert">{app.error}</p>{/if}
          <Boton disabled={app.ocupado} onclick={() => app.cocinar(actual.receta.id)}
            >Cocinar esta receta</Boton
          >
        </footer>
      </article>
    {/if}
  {/if}
</main>

<style>
  .elegir {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
    padding: var(--espacio-1) var(--espacio-6) var(--espacio-6);
    min-height: 0;
    overflow-y: auto;
  }
  .elegir.detalle-abierto {
    overflow: hidden;
  }
  .rejilla-vista {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-5);
  }
  .titulo-fila {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--espacio-4);
  }
  h1 {
    font-size: var(--texto-xl);
  }
  .con-que {
    margin: 0;
    color: var(--color-tinta-suave);
    text-align: right;
    max-width: 50%;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .ideas {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--espacio-5);
    padding: var(--espacio-3) var(--espacio-6) var(--espacio-3) var(--espacio-3);
    background: var(--color-acento-suave);
    border-radius: var(--radio-l);
  }
  .ideas h2 {
    font-size: var(--texto-l);
  }
  .ideas p {
    margin: 4px 0 0;
    color: var(--color-tinta-suave);
  }
  .rejilla {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--espacio-4);
  }
  .tarjeta {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0;
    font: inherit;
    text-align: left;
    color: var(--color-tinta);
    background: var(--color-superficie);
    border: 0;
    border-radius: var(--radio-l);
    overflow: hidden;
    cursor: pointer;
  }
  .tarjeta:hover {
    box-shadow: 0 0 0 var(--trazo) var(--color-tinta);
  }
  .foto {
    position: relative;
    height: 120px;
    display: grid;
    place-items: center;
    background: var(--color-acento-suave);
    overflow: hidden;
  }
  .foto img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .foto .comida {
    width: 96px;
    box-shadow: 0 0 0 10px var(--color-superficie);
  }
  .foto small {
    position: absolute;
    left: var(--espacio-2);
    bottom: var(--espacio-2);
    padding: 2px var(--espacio-2);
    border-radius: var(--radio-m);
    background: var(--color-superficie);
    font-size: var(--texto-xs);
    color: var(--color-tinta-suave);
  }
  .cuerpo {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
    padding: var(--espacio-3) var(--espacio-4) var(--espacio-4);
  }
  .nombre {
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-m);
    line-height: 1.2;
  }
  .volver {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--espacio-1) 0;
    font: inherit;
    font-size: var(--texto-s);
    font-weight: var(--peso-fuerte);
    color: var(--color-tinta);
    background: none;
    border: 0;
    text-decoration: underline;
    cursor: pointer;
  }
  .sin-revisar {
    font-size: var(--texto-xs);
    font-weight: 600;
    color: var(--color-tinta-suave);
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
  .faltan {
    margin-top: auto;
    align-self: flex-start;
    font-size: var(--texto-xs);
    font-weight: var(--peso-fuerte);
    padding: 4px var(--espacio-3);
    border-radius: var(--radio-m);
    background: var(--color-relleno);
  }
  .faltan.completa {
    background: var(--color-hierba-suave);
    color: var(--color-hierba);
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
  .cabeza {
    display: flex;
    gap: var(--espacio-5);
    align-items: center;
  }
  .plato {
    flex: none;
    width: 116px;
    height: 116px;
    border-radius: 50%;
    background: var(--color-acento-suave);
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .plato img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .comida {
    width: 76%;
    aspect-ratio: 1;
    border-radius: 50%;
    background:
      radial-gradient(circle at 35% 40%, #f0c75e 0 10%, transparent 11%),
      radial-gradient(circle at 62% 58%, #c9542f 0 9%, transparent 10%),
      radial-gradient(circle at 48% 30%, #7aa04a 0 6%, transparent 7%),
      radial-gradient(circle at 66% 34%, #c9542f 0 7%, transparent 8%),
      repeating-radial-gradient(circle at 50% 50%, #f3d07a 0 3px, #e8b955 3px 6px);
  }
  /* Ilustración mientras no haya foto: tres platos distintos para no repetir la misma tarjeta. */
  .comida.variante-1 {
    background:
      radial-gradient(circle at 40% 45%, #9bbf5d 0 14%, transparent 15%),
      radial-gradient(circle at 62% 58%, #e07a3a 0 11%, transparent 12%),
      repeating-radial-gradient(circle at 50% 50%, #f2e3c0 0 3px, #e3cd98 3px 6px);
  }
  .comida.variante-2 {
    background:
      radial-gradient(circle at 50% 50%, #ffe08a 0 22%, transparent 23%),
      radial-gradient(circle at 36% 40%, #c9542f 0 7%, transparent 8%),
      repeating-radial-gradient(circle at 50% 50%, #f7e9c6 0 3px, #ecd29a 3px 6px);
  }
  .detalle-abierto .detalle {
    flex: 1;
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
  }
  h2 {
    font-size: var(--texto-xl);
  }
  .descripcion {
    margin: 6px 0 0;
    color: var(--color-tinta-suave);
    line-height: 1.45;
    max-width: 60ch;
  }
  .aviso-foto {
    margin: 4px 0 0;
    font-size: var(--texto-xs);
    color: var(--color-tinta-suave);
  }
  .datos-receta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .datos-receta li {
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
  .etiquetas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .etiquetas li {
    font-size: var(--texto-xs);
    font-weight: 600;
    padding: 6px 12px;
    border-radius: var(--radio-pildora);
    background: var(--color-panel-suave);
  }
  .etiquetas .alerta {
    background: transparent;
    border: var(--borde) dashed var(--color-tinta);
  }
  .chef {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
  }
  .chef p {
    margin: 0;
  }
  .fila {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--espacio-3);
    flex-wrap: wrap;
  }
  h3 {
    font-family: var(--fuente-titulo);
    font-size: var(--texto-l);
    margin: 0;
  }
  .cobertura {
    margin: 0;
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
  }
  .lista {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--espacio-2) var(--espacio-4);
    margin-top: var(--espacio-3);
  }
  .lista li {
    display: flex;
    gap: var(--espacio-3);
    align-items: flex-start;
    padding: var(--espacio-2) 0;
    border-bottom: var(--borde) solid var(--color-separador);
  }
  .estado {
    flex: none;
    min-width: 76px;
    text-align: center;
    font-size: var(--texto-xs);
    font-weight: var(--peso-fuerte);
    padding: 3px 8px;
    border-radius: var(--radio-pildora);
    border: var(--borde) solid var(--color-borde-control);
  }
  .tienes .estado {
    background: var(--color-acento-suave);
    border-color: var(--color-tinta);
  }
  .falta .estado {
    background: var(--color-tinta);
    border-color: var(--color-tinta);
    color: var(--color-superficie);
  }
  .texto {
    display: flex;
    flex-direction: column;
  }
  .texto small {
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }
  .texto .sustitucion {
    color: var(--color-tinta);
    font-weight: 600;
  }
  .cargando {
    color: var(--color-tinta-suave);
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
    margin: 0;
    margin-right: auto;
    font-size: var(--texto-s);
    border-left: 4px solid var(--color-acento);
    padding-left: var(--espacio-3);
  }
</style>

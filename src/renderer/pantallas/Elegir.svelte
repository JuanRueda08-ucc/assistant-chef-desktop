<script lang="ts">
  import { escalarReceta } from '@shared/recetas/escalado'
  import { recuentoDisponibilidad } from '@shared/recetas/disponibilidad'
  import { NOMBRE_ALERGENO, NOMBRE_DIETA, NOMBRE_DIFICULTAD, NOMBRE_EQUIPO } from '@shared/textos'
  import type { Receta } from '@shared/types/receta'
  import Boton from '../componentes/Boton.svelte'
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import Globo from '../componentes/Globo.svelte'
  import Icono from '../componentes/Icono.svelte'
  import { app } from '../estado/app.svelte'
  import { describirIngrediente } from '../lib/medidas'

  // Elegir compara recetas en una lista (nombre, tiempo, nivel y lo que falta) y muestra la
  // elegida en detalle, con una sola acción para empezar (docs/replanteamiento-v1.md).
  const resultados = $derived(app.busqueda?.resultados ?? [])
  // Las descartadas por no estar revisadas no se mencionan: el usuario no debe verlas.
  const ocultas = $derived(
    (app.busqueda?.descartadas ?? []).filter((d) => !d.motivos.includes('no_revisada')).length
  )

  const indice = $derived(
    Math.max(
      0,
      resultados.findIndex((r) => r.receta.id === app.recetaVisibleId)
    )
  )
  const actual = $derived(resultados[Math.min(indice, resultados.length - 1)])
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
      ? recuentoDisponibilidad(recetaActual, app.preferencias.ingredientes, app.catalogo)
      : null
  )

  type Estado = 'tienes' | 'basico' | 'falta' | 'opcional'
  const ingredientes = $derived.by(() => {
    if (!escalada || !actual) return []
    const faltan = new Map(actual.faltantes.map((f) => [f.ingredienteId, f]))
    const marcados = new Set(app.preferencias.ingredientes)
    return escalada.ingredientes.map((ir) => {
      const catalogo = app.catalogo.find((i) => i.id === ir.ingredienteId)
      const faltante = faltan.get(ir.ingredienteId)
      const estado: Estado = faltante
        ? 'falta'
        : marcados.has(ir.ingredienteId)
          ? 'tienes'
          : catalogo?.esBasicoDespensa
            ? 'basico'
            : 'opcional'
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
  const ETIQUETA_ESTADO: Record<Estado, string> = {
    tienes: 'Lo tienes',
    basico: 'Básico',
    falta: 'Falta',
    opcional: 'Opcional'
  }

  function teclas(evento: KeyboardEvent): void {
    if (resultados.length < 2) return
    const paso = evento.key === 'ArrowDown' ? 1 : evento.key === 'ArrowUp' ? -1 : 0
    if (!paso) return
    evento.preventDefault()
    app.recetaVisibleId =
      resultados[(indice + paso + resultados.length) % resultados.length]!.receta.id
  }
</script>

<main class="elegir">
  {#if actual}
    <section class="comparar" aria-labelledby="titulo-elegir">
      <h1 id="titulo-elegir">
        {resultados.length}
        {resultados.length === 1 ? 'receta' : 'recetas'} con lo que tienes
      </h1>
      <p class="subtitulo">
        {resultados.length > 1 ? 'Ordenadas por lo poco que te falta.' : ''}
        {#if ocultas > 0}
          {ocultas} no aparecen por tus restricciones, tu tiempo o tu equipo.
        {/if}
      </p>
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <ul class="opciones" aria-label="Recetas" onkeydown={teclas}>
        {#each resultados as r (r.receta.id)}
          <li>
            <button
              type="button"
              aria-current={r.receta.id === actual.receta.id ? 'true' : undefined}
              onclick={() => (app.recetaVisibleId = r.receta.id)}
            >
              <span class="nombre">{r.receta.titulo}</span>
              <span class="datos">
                <span><Icono nombre="reloj" tamano={16} />{r.receta.tiempoTotalMin} min</span>
                <span>{NOMBRE_DIFICULTAD[r.receta.dificultad]}</span>
              </span>
              <span class="faltan" class:completa={r.faltantes.length === 0}
                >{r.faltantes.length === 0 ? 'Tienes todo' : `Faltan ${r.faltantes.length}`}</span
              >
            </button>
          </li>
        {/each}
      </ul>
      <Boton variante="secundario" onclick={() => app.irA('preparar')}>Cambiar ingredientes</Boton>
    </section>

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
            <h2 id="titulo-receta">{actual.receta.titulo}</h2>
            <p class="descripcion">{actual.receta.descripcion}</p>
            {#if !actual.receta.imagen}<p class="aviso-foto">Foto pendiente</p>{/if}
          </div>
        </header>

        <ul class="datos-receta" aria-label="Datos de la receta">
          <li><Icono nombre="reloj" tamano={18} />{actual.receta.tiempoTotalMin} min</li>
          <li>
            <Icono nombre="personas" tamano={18} />{porciones}
            {porciones === 1 ? 'porción' : 'porciones'}
          </li>
          <li><Icono nombre="nivel" tamano={18} />{NOMBRE_DIFICULTAD[actual.receta.dificultad]}</li>
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
  {:else}
    <section class="sin-recetas">
      <ChefBlob pose="busto" tamano={140} />
      <Globo cola="izquierda">
        <h1>Con lo que marcaste no encuentro recetas</h1>
        <p>{app.globo ?? 'Prueba a añadir más ingredientes o a ajustar tus preferencias.'}</p>
      </Globo>
      <Boton onclick={() => app.irA('preparar')}>Cambiar ingredientes</Boton>
    </section>
  {/if}
</main>

<style>
  .elegir {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: var(--espacio-5);
    padding: var(--espacio-1) var(--espacio-6) var(--espacio-6);
    min-height: 0;
  }
  .comparar {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
    min-height: 0;
  }
  h1 {
    font-size: 26px;
  }
  .subtitulo {
    margin: 0;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
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
    overflow-y: auto;
    min-height: 0;
    flex: 1;
    padding: 4px;
  }
  .opciones button {
    width: 100%;
    font: inherit;
    text-align: left;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px var(--espacio-3);
    padding: var(--espacio-3) var(--espacio-4);
    border-radius: var(--radio-m);
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    color: var(--color-tinta);
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
    grid-column: 1;
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
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    font-size: var(--texto-s);
    font-weight: var(--peso-fuerte);
    padding: 4px var(--espacio-3);
    border-radius: var(--radio-pildora);
    border: var(--borde) solid var(--color-tinta);
  }
  .faltan.completa {
    background: var(--color-acento);
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
  .sin-recetas {
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
  .sin-recetas h1 {
    font-size: var(--texto-xl);
  }
  .sin-recetas p {
    margin: var(--espacio-2) 0 0;
    color: var(--color-tinta-suave);
  }
</style>

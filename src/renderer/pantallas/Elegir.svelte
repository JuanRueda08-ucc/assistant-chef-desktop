<script lang="ts">
  import { escalarReceta } from '@shared/recetas/escalado'
  import { recuentoDisponibilidad } from '@shared/recetas/disponibilidad'
  import { aUnidadCasera, formatearMedida } from '@shared/recetas/unidades'
  import { NOMBRE_ALERGENO, NOMBRE_DIETA, NOMBRE_DIFICULTAD, NOMBRE_EQUIPO } from '@shared/textos'
  import type { Receta } from '@shared/types/receta'
  import Boton from '../componentes/Boton.svelte'
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import Globo from '../componentes/Globo.svelte'
  import Icono from '../componentes/Icono.svelte'
  import { app } from '../estado/app.svelte'

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

  // Receta completa de la tarjeta actual, para mostrar las cantidades que faltan ya escaladas.
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

  function cantidadDe(ingredienteId: string): string | null {
    const ir = escalada?.ingredientes.find((i) => i.ingredienteId === ingredienteId)
    const ingrediente = app.catalogo.find((i) => i.id === ingredienteId)
    if (!ir || !ingrediente) return null
    const medida = aUnidadCasera(ir.cantidad, ir.unidad, ingrediente)
    let texto = formatearMedida(medida)
    // formatearMedida deja solo el número para piezas; aquí no hay nombre al lado que lo complete.
    if (medida.unidad === 'unidad' && medida.cantidad !== null) {
      texto += medida.cantidad > 1 ? ' unidades' : ' unidad'
    }
    // Si la medida casera es otra que la de la receta, se añade la exacta entre paréntesis.
    if ((ir.unidad === 'g' || ir.unidad === 'ml') && medida.unidad !== ir.unidad) {
      texto += ` (${ir.cantidad} ${ir.unidad})`
    }
    return texto
  }

  function mover(paso: number): void {
    if (resultados.length === 0) return
    app.recetaVisibleId =
      resultados[(indice + paso + resultados.length) % resultados.length]!.receta.id
  }
  function teclas(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowLeft') mover(-1)
    if (evento.key === 'ArrowRight') mover(1)
  }
</script>

<main class="elegir">
  {#if actual}
    <section class="recetas" aria-labelledby="titulo-elegir">
      <h1 id="titulo-elegir">
        {resultados.length}
        {resultados.length === 1 ? 'receta' : 'recetas'} con lo que tienes
      </h1>
      <p class="subtitulo">
        {#if resultados.length > 1}Ordenadas por lo poco que te falta.{/if}
        {#if ocultas > 0}
          {ocultas} no aparecen por tus restricciones, tu tiempo o tu equipo.
        {/if}
      </p>

      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="carrusel"
        role="region"
        aria-roledescription="carrusel"
        aria-label="Recetas"
        onkeydown={teclas}
      >
        <button
          type="button"
          class="flecha"
          aria-label="Receta anterior"
          disabled={resultados.length < 2}
          onclick={() => mover(-1)}><Icono nombre="atras" /></button
        >

        <article
          class="receta"
          aria-roledescription="receta"
          aria-label="{indice + 1} de {resultados.length}: {actual.receta.titulo}"
        >
          <div class="plato">
            {#if actual.receta.imagen}
              <img src={actual.receta.imagen} alt="" />
            {:else}
              <span class="vecina uno"></span>
              <span class="vecina dos"></span>
              <div class="loza"><div class="comida"></div></div>
              <span class="aviso-foto">Foto pendiente</span>
            {/if}
          </div>
          <div class="cuerpo">
            <h2>{actual.receta.titulo}</h2>
            <p>{actual.receta.descripcion}</p>
            <ul class="capsulas">
              <li>
                <i><Icono nombre="reloj" /></i><b>{actual.receta.tiempoTotalMin}</b><small
                  >minutos</small
                >
              </li>
              <li>
                <i><Icono nombre="personas" /></i><b>{porciones}</b><small
                  >{porciones === 1 ? 'porción' : 'porciones'}</small
                >
              </li>
              <li>
                <i><Icono nombre="nivel" /></i><b>{NOMBRE_DIFICULTAD[actual.receta.dificultad]}</b
                ><small>nivel</small>
              </li>
              {#if actual.receta.equipo[0]}
                <li>
                  <i><Icono nombre="olla" /></i><b>{actual.receta.equipo.length}</b><small
                    >{actual.receta.equipo
                      .map((e) => NOMBRE_EQUIPO[e].toLocaleLowerCase('es'))
                      .join(', ')}</small
                  >
                </li>
              {/if}
            </ul>
            <ul class="etiquetas">
              {#each actual.receta.dietas as d (d)}<li>{NOMBRE_DIETA[d]}</li>{/each}
              {#each actual.receta.alergenos as a (a)}<li class="alerta">
                  Contiene {NOMBRE_ALERGENO[a].toLocaleLowerCase('es')}
                </li>{/each}
            </ul>
          </div>
        </article>

        <button
          type="button"
          class="flecha"
          aria-label="Receta siguiente"
          disabled={resultados.length < 2}
          onclick={() => mover(1)}><Icono nombre="siguiente" /></button
        >
      </div>

      {#if resultados.length > 1}
        <div class="puntos" role="group" aria-label="Elegir receta">
          {#each resultados as r, i (r.receta.id)}
            <button
              type="button"
              aria-label="Ver {r.receta.titulo}"
              aria-current={i === indice ? 'true' : undefined}
              onclick={() => (app.recetaVisibleId = r.receta.id)}
            ></button>
          {/each}
        </div>
      {/if}
    </section>

    <aside class="falta" aria-labelledby="titulo-falta">
      <div class="cabeza">
        <ChefBlob pose="busto" tamano={84} />
        <h2 id="titulo-falta">
          {actual.faltantes.length === 0 ? 'Tienes todo lo necesario' : 'Qué te falta'}
        </h2>
      </div>
      {#if app.globo}<Globo cola="abajo"><p>{app.globo}</p></Globo>{/if}
      <div class="cobertura">
        <span
          >{actual.ingredientesObligatorios - actual.faltantes.length} de {actual.ingredientesObligatorios}
          ingredientes disponibles</span
        >
        {#if disponibilidad}
          <small
            >{disponibilidad.seleccionados} seleccionados por ti{disponibilidad.basicos.length
              ? ` + ${disponibilidad.basicos.length} básicos de despensa`
              : ''}.</small
          >
          {#if disponibilidad.basicos.length}
            <small>Damos por disponibles: {disponibilidad.basicos.join(', ')}.</small>
          {/if}
        {/if}
        <div
          class="barra"
          role="progressbar"
          aria-label="Ingredientes disponibles, incluidos los básicos de despensa"
          aria-valuemin="0"
          aria-valuemax={actual.ingredientesObligatorios}
          aria-valuenow={actual.ingredientesObligatorios - actual.faltantes.length}
        >
          <span style:width="{actual.cobertura * 100}%"></span>
        </div>
      </div>

      <ul class="lista">
        {#each actual.faltantes as f (f.ingredienteId)}
          <li>
            <b>{f.nombre}</b>
            {#if cantidadDe(f.ingredienteId)}<small>{cantidadDe(f.ingredienteId)}</small>{/if}
            {#each f.sustituciones as s (s.sustitucionId)}
              <span class="sustitucion">Puedes usar {s.nombreDestino.toLocaleLowerCase('es')}</span>
            {/each}
          </li>
        {/each}
        {#each actual.opcionalesFaltantes as o (o.ingredienteId)}
          <li class="opcional"><b>{o.nombre}</b><small>Opcional</small></li>
        {/each}
      </ul>

      {#if app.error}<p class="error" role="alert">{app.error}</p>{/if}
      <div class="acciones">
        <Boton ancho disabled={app.ocupado} onclick={() => app.cocinar(actual.receta.id)}
          >Cocinar esta receta</Boton
        >
        <Boton variante="secundario" ancho onclick={() => app.irA('preparar')}
          >Cambiar ingredientes</Boton
        >
      </div>
    </aside>
  {:else}
    <section class="sin-recetas">
      <ChefBlob pose="busto" tamano={160} />
      <Globo cola="izquierda">
        <h1>Con lo que marcaste no encuentro recetas</h1>
        <p>{app.globo ?? 'Prueba a marcar más ingredientes o a ajustar tus preferencias.'}</p>
      </Globo>
      <Boton onclick={() => app.irA('preparar')}>Cambiar ingredientes</Boton>
    </section>
  {/if}
</main>

<style>
  .elegir {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 28px;
    padding: var(--espacio-1) var(--espacio-6) var(--espacio-6);
    min-height: 0;
  }
  .recetas {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
    min-height: 0;
  }
  h1 {
    font-size: var(--texto-xl);
  }
  .subtitulo {
    margin: -8px 0 0;
    color: var(--color-tinta-suave);
  }
  .carrusel {
    display: grid;
    grid-template-columns: 56px 1fr 56px;
    align-items: center;
    gap: var(--espacio-3);
    flex: 1;
    min-height: 0;
  }
  .flecha {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: var(--trazo) solid var(--color-tinta);
    background: var(--color-superficie);
    color: var(--color-tinta);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .flecha:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .receta {
    background: var(--color-superficie);
    border: var(--borde) solid var(--color-separador);
    border-radius: var(--radio-xl);
    overflow: hidden;
    display: grid;
    grid-template-rows: minmax(160px, 1fr) auto;
    height: 100%;
    min-height: 0;
  }
  .plato {
    position: relative;
    display: grid;
    place-items: center;
    background: var(--color-acento-suave);
    overflow: hidden;
    min-height: 0;
  }
  .plato img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .loza {
    width: min(210px, 80%);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--color-superficie);
    display: grid;
    place-items: center;
  }
  .comida {
    width: 72%;
    aspect-ratio: 1;
    border-radius: 50%;
    background:
      radial-gradient(circle at 35% 40%, #f0c75e 0 10%, transparent 11%),
      radial-gradient(circle at 62% 58%, #c9542f 0 9%, transparent 10%),
      radial-gradient(circle at 48% 30%, #7aa04a 0 6%, transparent 7%),
      radial-gradient(circle at 66% 34%, #c9542f 0 7%, transparent 8%),
      radial-gradient(circle at 34% 64%, #7aa04a 0 5%, transparent 6%),
      repeating-radial-gradient(circle at 50% 50%, #f3d07a 0 3px, #e8b955 3px 6px);
  }
  .vecina {
    position: absolute;
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: var(--color-superficie);
    opacity: 0.7;
  }
  .vecina.uno {
    left: -30px;
    top: 20px;
  }
  .vecina.dos {
    right: -20px;
    bottom: -10px;
  }
  .aviso-foto {
    position: absolute;
    left: var(--espacio-4);
    bottom: 14px;
    font-size: 12px;
    background: var(--color-superficie);
    color: var(--color-tinta-suave);
    padding: 4px 10px;
    border-radius: var(--radio-pildora);
  }
  .cuerpo {
    padding: 22px 26px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .cuerpo h2 {
    font-size: var(--texto-xl);
  }
  .cuerpo p {
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
  .capsulas {
    display: flex;
    gap: var(--espacio-3);
  }
  .capsulas li {
    min-width: 84px;
    max-width: 120px;
    border-radius: var(--radio-pildora);
    background: var(--color-acento);
    border: var(--trazo) solid var(--color-tinta);
    padding: 6px 6px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  }
  .capsulas i {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--color-superficie);
    display: grid;
    place-items: center;
  }
  .capsulas b {
    font-family: var(--fuente-titulo);
    font-size: 20px;
    line-height: 1;
  }
  .capsulas small {
    font-size: 12px;
    font-weight: 600;
    padding: 0 4px;
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
  .puntos {
    display: flex;
    gap: var(--espacio-2);
    justify-content: center;
  }
  .puntos button {
    width: 12px;
    height: 12px;
    padding: 0;
    border-radius: 50%;
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    cursor: pointer;
  }
  .puntos button[aria-current='true'] {
    width: 30px;
    border-radius: var(--radio-pildora);
    background: var(--color-tinta);
    border-color: var(--color-tinta);
  }

  .falta {
    background: var(--color-superficie);
    border: var(--borde) solid var(--color-separador);
    border-radius: var(--radio-xl);
    padding: var(--espacio-5);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
    min-height: 0;
  }
  .cabeza {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .falta h2 {
    font-size: var(--texto-l);
  }
  .cobertura {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
    font-size: var(--texto-s);
  }
  .barra {
    height: 12px;
    border-radius: var(--radio-pildora);
    background: var(--color-panel-suave);
    border: var(--borde) solid var(--color-borde-control);
    overflow: hidden;
  }
  .barra span {
    display: block;
    height: 100%;
    background: var(--color-acento);
  }
  .lista {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
    overflow-y: auto;
    min-height: 0;
    flex: 1;
  }
  .lista li {
    display: grid;
    grid-template-columns: 10px 1fr;
    column-gap: var(--espacio-3);
    align-items: start;
  }
  .lista li::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-tinta);
    margin-top: 7px;
    grid-row: span 3;
  }
  .lista .opcional::before {
    background: transparent;
    border: var(--borde) solid var(--color-tinta);
  }
  .lista small {
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }
  .sustitucion {
    justify-self: start;
    margin-top: 6px;
    font-size: var(--texto-xs);
    font-weight: 600;
    padding: 4px 10px;
    border-radius: var(--radio-pildora);
    background: var(--color-acento-suave);
    border: var(--borde) solid var(--color-tinta);
  }
  .acciones {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
  }
  .error {
    margin: 0;
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

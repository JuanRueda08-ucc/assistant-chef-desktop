<script lang="ts">
  import { agruparPorCategoria, buscarIngredientes } from '@shared/recetas/catalogo'
  import {
    anadirSinIdentificar,
    explicarPendientes,
    quitarSinIdentificar,
    resolverIngredientes,
    separarIngredientes,
    unirLista,
    type ListaResuelta
  } from '@shared/recetas/lista'
  import type { Ingrediente } from '@shared/types/receta'
  import { NOMBRE_ALERGENO, NOMBRE_CATEGORIA, NOMBRE_DIETA, NOMBRE_EQUIPO } from '@shared/textos'
  import {
    ALERGENOS,
    CATEGORIAS_INGREDIENTE,
    DIETAS,
    EQUIPOS,
    type Alergeno,
    type CategoriaIngrediente,
    type Dificultad,
    type Equipo
  } from '@shared/types/receta'
  import { PORCIONES_MAX, PORCIONES_MIN } from '@shared/esquemas/sesion'
  import Boton from '../componentes/Boton.svelte'
  import Chip from '../componentes/Chip.svelte'
  import Icono from '../componentes/Icono.svelte'
  import Panel from '../componentes/Panel.svelte'
  import { app } from '../estado/app.svelte'

  const prefs = $derived(app.preferencias)

  // Los básicos de despensa se dan por presentes: no se muestran para marcar.
  const elegibles = $derived(app.catalogo.filter((i) => !i.esBasicoDespensa))
  const basicos = $derived(
    app.catalogo
      .filter((i) => i.esBasicoDespensa)
      .map((i, n) => (n === 0 ? i.nombre : i.nombre.toLocaleLowerCase('es')))
  )
  const grupos = $derived(agruparPorCategoria(elegibles))

  let categoria = $state<CategoriaIngrediente>('verduras')
  let consulta = $state('')
  // Con varios ingredientes escritos («pollo, arroz y cebolla») no se filtra la rejilla: Intro
  // los añade todos (decisión 0015).
  const textos = $derived(separarIngredientes(consulta))
  const visibles = $derived(
    textos.length > 1
      ? []
      : consulta.trim()
        ? buscarIngredientes(elegibles, consulta)
        : (grupos.get(categoria) ?? [])
  )

  // Lo que no se pudo añadir directamente tras pulsar Intro: candidatos para elegir y un aviso.
  let dudas = $state.raw<ListaResuelta['ambiguos']>([])
  let aviso = $state<string | null>(null)
  function anadirEscritos(): void {
    if (!textos.length) return
    const resuelta = resolverIngredientes(app.catalogo, textos)
    for (const id of resuelta.ids) if (!prefs.ingredientes.includes(id)) prefs.ingredientes.push(id)
    prefs.ingredientesSinIdentificar = anadirSinIdentificar(
      prefs.ingredientesSinIdentificar,
      resuelta.desconocidos
    )
    dudas = resuelta.ambiguos
    const nombres = resuelta.ids.map((id) => porId.get(id)?.nombre ?? id)
    aviso =
      [
        nombres.length
          ? `Añadido: ${unirLista(nombres.map((n) => n.toLocaleLowerCase('es')))}.`
          : '',
        explicarPendientes({ ...resuelta, ambiguos: [] })
      ]
        .filter(Boolean)
        .join(' ') || null
    consulta = ''
  }
  function elegirDuda(texto: string, ingrediente: Ingrediente): void {
    if (!prefs.ingredientes.includes(ingrediente.id)) prefs.ingredientes.push(ingrediente.id)
    dudas = dudas.filter((d) => d.texto !== texto)
  }
  function quitarPendiente(texto: string): void {
    prefs.ingredientesSinIdentificar = quitarSinIdentificar(prefs.ingredientesSinIdentificar, [
      texto
    ])
  }
  // Buscar un ingrediente sin identificar con otro nombre: se quita y se escribe en el buscador.
  function corregirPendiente(texto: string): void {
    quitarPendiente(texto)
    consulta = texto
    document.getElementById('buscar-ingrediente')?.focus()
  }
  const marcados = $derived(new Set(prefs.ingredientes))
  const marcadosEn = (c: CategoriaIngrediente): number =>
    (grupos.get(c) ?? []).filter((i) => marcados.has(i.id)).length

  function alternar<T>(lista: T[], valor: T): void {
    const i = lista.indexOf(valor)
    if (i === -1) lista.push(valor)
    else lista.splice(i, 1)
  }

  const TIEMPOS: { texto: string; valor: number | null }[] = [
    { texto: '30 min', valor: 30 },
    { texto: '1 hora', valor: 60 },
    { texto: 'Sin prisa', valor: null }
  ]
  const NIVELES: { texto: string; valor: Dificultad | null }[] = [
    { texto: 'Fáciles', valor: 'facil' },
    { texto: 'Fáciles y medias', valor: 'media' },
    { texto: 'Todas', valor: null }
  ]
  const ALERGIAS_FRECUENTES: Alergeno[] = [
    'gluten',
    'lacteos',
    'huevo',
    'frutos_secos',
    'crustaceos'
  ]
  const EQUIPO_FRECUENTE: Equipo[] = ['olla', 'sarten', 'horno', 'microondas', 'licuadora']
  let todasLasAlergias = $state(false)
  let todoElEquipo = $state(false)
  const alergiasVisibles = $derived(
    todasLasAlergias
      ? [...ALERGENOS]
      : ALERGENOS.filter((a) => ALERGIAS_FRECUENTES.includes(a) || prefs.alergias.includes(a))
  )
  const equipoVisible = $derived(
    todoElEquipo
      ? [...EQUIPOS]
      : EQUIPOS.filter((e) => EQUIPO_FRECUENTE.includes(e) || prefs.equipo.includes(e))
  )

  // Lo que el usuario ha añadido, en el orden en que lo añadió (sin los básicos asumidos).
  const porId = $derived(new Map(app.catalogo.map((i) => [i.id, i])))
  const lista = $derived(
    prefs.ingredientes.flatMap((id) => {
      const ingrediente = porId.get(id)
      return ingrediente && !ingrediente.esBasicoDespensa ? [ingrediente] : []
    })
  )

  // Resumen de las preferencias, visible aunque el panel esté cerrado (replanteamiento-v1).
  const etiquetas = $derived([
    {
      texto: TIEMPOS.find((t) => t.valor === prefs.tiempoMaxMin)?.texto ?? 'Sin prisa',
      alerta: false
    },
    {
      texto:
        prefs.nivel === null
          ? 'Cualquier nivel'
          : (NIVELES.find((n) => n.valor === prefs.nivel)?.texto ?? 'Cualquier nivel'),
      alerta: false
    },
    ...prefs.restricciones.map((d) => ({ texto: NOMBRE_DIETA[d], alerta: false })),
    ...prefs.alergias.map((a) => ({
      texto: `Sin ${NOMBRE_ALERGENO[a].toLocaleLowerCase('es')}`,
      alerta: true
    })),
    ...prefs.equipo.map((e) => ({ texto: NOMBRE_EQUIPO[e], alerta: false }))
  ])
  let panelPreferencias = $state(false)

  const enDespensa = $derived(lista.length + prefs.ingredientesSinIdentificar.length)
  let confirmarVaciar = $state(false)
  function vaciarDespensa(): void {
    prefs.ingredientes = []
    prefs.ingredientesSinIdentificar = []
    dudas = []
    aviso = null
    confirmarVaciar = false
  }
</script>

<main class="preparar">
  <section class="ingredientes" aria-labelledby="titulo-preparar">
    <div class="saludo">
      <h1 id="titulo-preparar">¿Qué tienes hoy?</h1>
      <p aria-live="polite">
        {app.globo ?? 'Busca o escribe varios a la vez: pollo, arroz, cebolla.'}
      </p>
    </div>

    <form
      class="buscar"
      role="search"
      onsubmit={(e) => {
        e.preventDefault()
        anadirEscritos()
      }}
    >
      <Icono nombre="buscar" tamano={24} />
      <label for="buscar-ingrediente" class="oculto">Buscar o escribir ingredientes</label>
      <input
        id="buscar-ingrediente"
        type="search"
        placeholder="Buscar ingredientes"
        autocomplete="off"
        bind:value={consulta}
      />
      {#if textos.length}
        <button type="submit" class="anadir"
          >{textos.length > 1 ? `Añadir ${textos.length}` : 'Añadir'}</button
        >
      {/if}
    </form>

    {#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}
    {#each dudas as duda (duda.texto)}
      <div class="duda" role="group" aria-label="¿Qué es «{duda.texto}»?">
        <span>¿«{duda.texto}» es…?</span>
        {#each duda.candidatos as c (c.id)}
          <Chip onclick={() => elegirDuda(duda.texto, c)}>{c.nombre}</Chip>
        {/each}
        <button
          type="button"
          class="mas"
          onclick={() => (dudas = dudas.filter((d) => d.texto !== duda.texto))}>Ninguno</button
        >
      </div>
    {/each}

    {#if !consulta.trim()}
      <div class="categorias" role="group" aria-label="Categorías">
        {#each CATEGORIAS_INGREDIENTE as c (c)}
          <button
            type="button"
            class="categoria"
            aria-pressed={categoria === c}
            onclick={() => (categoria = c)}
          >
            {NOMBRE_CATEGORIA[c]}
            {#if marcadosEn(c) > 0}<span class="cuenta">{marcadosEn(c)}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    {#if visibles.length > 0}
      <div class="rejilla" role="group" aria-label="Ingredientes">
        {#each visibles as ingrediente (ingrediente.id)}
          <button
            type="button"
            class="ficha"
            aria-pressed={marcados.has(ingrediente.id)}
            onclick={() => alternar(prefs.ingredientes, ingrediente.id)}
          >
            {ingrediente.nombre}
            <span class="marca"
              ><Icono nombre={marcados.has(ingrediente.id) ? 'check' : 'mas'} tamano={16} /></span
            >
          </button>
        {/each}
      </div>
    {:else if textos.length > 1}
      <p class="vacio">
        Pulsa Intro para añadir {unirLista(textos.map((t) => `«${t}»`))}.
      </p>
    {:else if consulta.trim()}
      <p class="vacio">
        «{consulta.trim()}» no está en el catálogo. Pulsa Intro para añadirlo a tu despensa; sus
        alérgenos quedarán sin verificar.
      </p>
    {:else}
      <p class="vacio">
        Todavía no hay ingredientes de {NOMBRE_CATEGORIA[categoria].toLocaleLowerCase('es')} en el catálogo.
      </p>
    {/if}
  </section>

  <aside class="preferencias" aria-labelledby="titulo-lista">
    <div class="cuerpo">
      <section class="bloque">
        <div class="fila">
          <h2 id="titulo-lista">Tu despensa <span class="cuantos">{enDespensa}</span></h2>
          {#if enDespensa > 0 && !confirmarVaciar}
            <button type="button" class="mas" onclick={() => (confirmarVaciar = true)}
              >Vaciar</button
            >
          {/if}
        </div>
        {#if confirmarVaciar && enDespensa > 0}
          <div class="confirmar" role="group" aria-label="Confirmar vaciar la despensa">
            <span>¿Quitar todos los ingredientes?</span>
            <Boton variante="oscuro" onclick={vaciarDespensa}>Sí, vaciar</Boton>
            <Boton variante="secundario" onclick={() => (confirmarVaciar = false)}>No</Boton>
          </div>
        {/if}
        {#if enDespensa > 0}
          <ul class="lista" aria-label="Ingredientes añadidos">
            {#each lista as ingrediente (ingrediente.id)}
              <li>
                {ingrediente.nombre}
                <button
                  type="button"
                  aria-label="Quitar {ingrediente.nombre}"
                  onclick={() => alternar(prefs.ingredientes, ingrediente.id)}
                  ><Icono nombre="cerrar" tamano={16} /></button
                >
              </li>
            {/each}
            {#each prefs.ingredientesSinIdentificar as texto (texto)}
              <li class="sin-identificar">
                <button
                  type="button"
                  class="texto"
                  title="Buscarlo con otro nombre"
                  onclick={() => corregirPendiente(texto)}
                  >{texto} <small>alérgenos sin verificar</small></button
                >
                <button
                  type="button"
                  aria-label="Quitar {texto}"
                  onclick={() => quitarPendiente(texto)}
                  ><Icono nombre="cerrar" tamano={16} /></button
                >
              </li>
            {/each}
          </ul>
        {:else}
          <p class="ayuda">
            Tu despensa está vacía. Busca ingredientes, elígelos por categoría o díselos al chef. Se
            guarda para la próxima vez.
          </p>
        {/if}
        {#if prefs.alergias.length > 0 && prefs.ingredientesSinIdentificar.length > 0}
          <p class="aviso" role="status">
            Tienes alergias registradas y no puedo comprobar
            {unirLista(prefs.ingredientesSinIdentificar.map((t) => `«${t}»`))}. Revisa su etiqueta
            antes de usarlo.
          </p>
        {/if}
        {#if basicos.length > 0}
          <p class="basicos">
            {unirLista(basicos)} los damos por hecho.
          </p>
        {/if}
      </section>

      <div class="porciones">
        <span id="etiqueta-porciones" class="nombre">Cocinas para</span>
        <div class="contador" role="group" aria-labelledby="etiqueta-porciones">
          <button
            type="button"
            aria-label="Una porción menos"
            disabled={prefs.porciones <= PORCIONES_MIN}
            onclick={() => (prefs.porciones -= 1)}><Icono nombre="menos" /></button
          >
          <output aria-live="polite"
            >{prefs.porciones}<small>{prefs.porciones === 1 ? 'persona' : 'personas'}</small
            ></output
          >
          <button
            type="button"
            aria-label="Una porción más"
            disabled={prefs.porciones >= PORCIONES_MAX}
            onclick={() => (prefs.porciones += 1)}><Icono nombre="mas" /></button
          >
        </div>
      </div>

      <section class="bloque" aria-labelledby="titulo-preferencias">
        <div class="fila">
          <h2 id="titulo-preferencias">Preferencias</h2>
          <button type="button" class="mas" onclick={() => (panelPreferencias = true)}
            >Cambiar</button
          >
        </div>
        <ul class="etiquetas" aria-label="Preferencias activas">
          {#each etiquetas as e (e.texto)}<li class:alerta={e.alerta}>{e.texto}</li>{/each}
        </ul>
      </section>
    </div>

    <div class="pie">
      {#if app.error}<p class="error" role="alert">{app.error}</p>{/if}
      {#if enDespensa === 0}
        <p class="ayuda" role="status">Añade al menos un ingrediente para buscar recetas.</p>
      {/if}
      <Boton ancho disabled={app.ocupado || enDespensa === 0} onclick={() => app.buscar()}>
        Buscar recetas
      </Boton>
    </div>

    {#if panelPreferencias}
      <Panel titulo="Preferencias" alCerrar={() => (panelPreferencias = false)}>
        <div class="campos">
          <fieldset>
            <legend>Tiempo que tienes</legend>
            <div class="chips">
              {#each TIEMPOS as t (t.texto)}
                <Chip
                  seleccionado={prefs.tiempoMaxMin === t.valor}
                  onclick={() => (prefs.tiempoMaxMin = t.valor)}>{t.texto}</Chip
                >
              {/each}
            </div>
          </fieldset>

          <fieldset>
            <legend>Recetas</legend>
            <div class="chips">
              {#each NIVELES as n (n.texto)}
                <Chip seleccionado={prefs.nivel === n.valor} onclick={() => (prefs.nivel = n.valor)}
                  >{n.texto}</Chip
                >
              {/each}
            </div>
          </fieldset>

          <fieldset>
            <legend>Comemos</legend>
            <div class="chips">
              {#each DIETAS as d (d)}
                <Chip
                  seleccionado={prefs.restricciones.includes(d)}
                  onclick={() => alternar(prefs.restricciones, d)}>{NOMBRE_DIETA[d]}</Chip
                >
              {/each}
            </div>
          </fieldset>

          <fieldset>
            <legend>Alergias</legend>
            <div class="chips">
              {#each alergiasVisibles as a (a)}
                <Chip
                  seleccionado={prefs.alergias.includes(a)}
                  onclick={() => alternar(prefs.alergias, a)}>{NOMBRE_ALERGENO[a]}</Chip
                >
              {/each}
              {#if !todasLasAlergias}
                <button type="button" class="mas" onclick={() => (todasLasAlergias = true)}
                  >Ver todas</button
                >
              {/if}
            </div>
          </fieldset>

          <fieldset>
            <legend>Tengo</legend>
            <div class="chips">
              {#each equipoVisible as e (e)}
                <Chip
                  seleccionado={prefs.equipo.includes(e)}
                  onclick={() => alternar(prefs.equipo, e)}>{NOMBRE_EQUIPO[e]}</Chip
                >
              {/each}
              {#if !todoElEquipo}
                <button type="button" class="mas" onclick={() => (todoElEquipo = true)}
                  >Ver todo</button
                >
              {/if}
            </div>
            {#if prefs.equipo.length === 0}
              <p class="ayuda">Si no marcas nada, no filtramos por equipo.</p>
            {/if}
          </fieldset>
        </div>
      </Panel>
    {/if}
  </aside>
</main>

<style>
  .preparar {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: var(--espacio-5);
    padding: var(--espacio-1) var(--espacio-6) var(--espacio-6);
    min-height: 0;
  }
  .ingredientes {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-height: 0;
    overflow-y: auto;
    padding: 4px;
  }
  h1 {
    font-size: 32px;
    line-height: 1.1;
  }
  .saludo p {
    margin: 4px 0 0;
    color: var(--color-tinta-suave);
  }
  .buscar {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
    background: var(--color-superficie);
    border-radius: var(--radio-l);
    padding: 0 8px 0 var(--espacio-5);
    color: var(--color-tinta);
  }
  .buscar:focus-within {
    outline: var(--foco);
    outline-offset: 3px;
  }
  .buscar input {
    flex: 1;
    font: inherit;
    border: 0;
    background: transparent;
    font-size: 18px;
    color: var(--color-tinta);
    min-height: 64px;
    outline: none;
  }
  .oculto {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .categorias {
    display: flex;
    gap: var(--espacio-2);
    flex-wrap: wrap;
  }
  .categoria {
    font: inherit;
    font-size: var(--texto-s);
    font-weight: var(--peso-fuerte);
    display: inline-flex;
    align-items: center;
    gap: var(--espacio-2);
    min-height: var(--alto-control);
    padding: 0 var(--espacio-4);
    border: 0;
    border-radius: var(--radio-boton);
    background: var(--color-relleno);
    color: var(--color-tinta);
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .categoria:hover {
    transform: translateY(-1px);
  }
  .categoria[aria-pressed='true'] {
    background: var(--color-tinta);
    color: var(--color-superficie);
  }
  .cuenta {
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--radio-pildora);
    background: var(--color-acento);
    color: var(--color-tinta);
    font-size: 12px;
    display: grid;
    place-items: center;
  }
  .rejilla {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: var(--espacio-3);
  }
  .ficha {
    font: inherit;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-m);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--espacio-3);
    min-height: 64px;
    padding: 0 var(--espacio-3) 0 var(--espacio-4);
    border: 0;
    border-radius: var(--radio-m);
    background: var(--color-superficie);
    color: var(--color-tinta);
    text-align: left;
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .ficha:hover {
    transform: translateY(-2px);
  }
  .ficha:active {
    transform: translateY(1px);
  }
  .ficha[aria-pressed='true'] {
    background: var(--color-acento);
    box-shadow: var(--sombra-boton);
  }
  .marca {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--color-relleno);
    display: grid;
    place-items: center;
  }
  .ficha[aria-pressed='true'] .marca {
    background: var(--color-tinta);
    color: var(--color-superficie);
  }
  .ficha[aria-pressed='true'] .marca :global(.icono) {
    stroke-width: 3;
  }
  .vacio,
  .basicos {
    margin: 0;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }

  .preferencias {
    position: relative;
    overflow: hidden;
    background: var(--color-superficie);
    border-radius: var(--radio-xl);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .cuerpo {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--espacio-5) var(--espacio-5) var(--espacio-3);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
  }
  .preferencias h2 {
    font-size: var(--texto-l);
  }
  .bloque {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
  }
  .cuantos {
    display: inline-grid;
    place-items: center;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    margin-left: 6px;
    border-radius: var(--radio-pildora);
    background: var(--color-relleno);
    color: var(--color-tinta);
    font-size: var(--texto-s);
    vertical-align: middle;
  }
  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .lista li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 4px 4px var(--espacio-3);
    border-radius: var(--radio-m);
    background: var(--color-acento-suave);
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
  }
  .lista button {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 0;
    background: transparent;
    color: var(--color-tinta);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .lista button:hover {
    background: var(--color-superficie);
  }
  .lista .sin-identificar {
    background: var(--color-superficie);
    outline: 2px dashed var(--color-borde-control);
    outline-offset: -2px;
  }
  .lista .texto {
    width: auto;
    height: auto;
    border-radius: var(--radio-pildora);
    font: inherit;
    font-weight: 600;
    display: inline;
    padding: 0;
  }
  .lista .texto small {
    font-weight: 400;
    color: var(--color-tinta-suave);
  }
  .anadir {
    font: inherit;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
    min-height: var(--alto-control);
    padding: 0 var(--espacio-4);
    border: 0;
    border-radius: var(--radio-boton);
    background: var(--color-acento);
    box-shadow: var(--sombra-boton);
    color: var(--color-tinta);
    cursor: pointer;
    white-space: nowrap;
  }
  .aviso {
    margin: 0;
    font-size: var(--texto-s);
    border-left: 4px solid var(--color-acento);
    padding-left: var(--espacio-3);
  }
  .duda {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espacio-2);
    font-weight: 600;
  }
  .confirmar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espacio-2);
    font-size: var(--texto-s);
    font-weight: 600;
  }
  .fila {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--espacio-2);
  }
  .etiquetas {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .etiquetas li {
    padding: 6px var(--espacio-3);
    border-radius: var(--radio-m);
    background: var(--color-relleno);
    font-size: var(--texto-s);
    font-weight: var(--peso-fuerte);
  }
  .etiquetas .alerta {
    background: transparent;
    outline: 2px dashed var(--color-borde-control);
    outline-offset: -2px;
  }
  /* Fuera del desplazamiento: con la despensa llena, buscar recetas sigue a la vista. */
  .pie {
    padding: var(--espacio-3) var(--espacio-5) var(--espacio-5);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
  }
  .campos {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .porciones {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--espacio-4) 0;
    border-top: var(--borde) solid var(--color-separador);
    border-bottom: var(--borde) solid var(--color-separador);
  }
  .nombre {
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-titulo);
    font-size: var(--texto-m);
  }
  legend {
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    margin-bottom: 10px;
  }
  .contador {
    display: flex;
    align-items: center;
    gap: var(--espacio-4);
  }
  .contador output {
    font-family: var(--fuente-titulo);
    font-size: 28px;
    font-weight: var(--peso-fuerte);
    min-width: 70px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .contador small {
    display: block;
    font-family: var(--fuente-texto);
    font-size: var(--texto-xs);
    font-weight: 600;
    color: var(--color-tinta-suave);
  }
  .contador button {
    width: var(--alto-control);
    height: var(--alto-control);
    border-radius: var(--radio-boton);
    border: 0;
    background: var(--color-relleno);
    color: var(--color-tinta);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .contador button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .mas {
    font: inherit;
    font-size: var(--texto-s);
    font-weight: 600;
    background: none;
    border: 0;
    color: var(--color-tinta);
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: var(--espacio-2);
    cursor: pointer;
  }
  .ayuda {
    margin: var(--espacio-2) 0 0;
    font-size: var(--texto-xs);
    color: var(--color-tinta-suave);
  }
  .error {
    margin: 0;
    font-size: var(--texto-s);
    color: var(--color-tinta);
    border-left: 4px solid var(--color-acento);
    padding-left: var(--espacio-3);
  }
</style>

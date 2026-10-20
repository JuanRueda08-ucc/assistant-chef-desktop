<script lang="ts">
  import { agruparPorCategoria, buscarIngredientes } from '@shared/recetas/catalogo'
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
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import Chip from '../componentes/Chip.svelte'
  import Globo from '../componentes/Globo.svelte'
  import Icono from '../componentes/Icono.svelte'
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
  const visibles = $derived(
    consulta.trim() ? buscarIngredientes(elegibles, consulta) : (grupos.get(categoria) ?? [])
  )
  const marcados = $derived(new Set(prefs.ingredientes))
  const marcadosElegibles = $derived(elegibles.filter((i) => marcados.has(i.id)).length)
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

  const unirConY = (nombres: string[]): string =>
    nombres.length <= 1
      ? (nombres[0] ?? '')
      : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
</script>

<main class="preparar">
  <section class="ingredientes" aria-labelledby="titulo-preparar">
    <div class="saludo">
      <ChefBlob pose="busto" tamano={112} />
      <Globo cola="izquierda">
        <h1 id="titulo-preparar">¿Qué tienes hoy en la cocina?</h1>
        <p>
          {app.globo ?? 'Marca lo que tengas o escríbelo al chef y te digo qué podemos preparar.'}
        </p>
      </Globo>
    </div>

    <label class="buscar">
      <Icono nombre="buscar" />
      <span class="oculto">Buscar un ingrediente</span>
      <input
        type="search"
        placeholder="Busca un ingrediente: cebolla, arroz, pimentón…"
        bind:value={consulta}
      />
    </label>

    {#if !consulta.trim()}
      <div class="categorias" role="group" aria-label="Categorías">
        {#each CATEGORIAS_INGREDIENTE as c (c)}
          <button
            type="button"
            class="categoria"
            aria-pressed={categoria === c}
            onclick={() => (categoria = c)}
          >
            <span class="circulo">
              <Icono nombre={c} />
              {#if marcadosEn(c) > 0}<span class="cuenta">{marcadosEn(c)}</span>{/if}
            </span>
            {NOMBRE_CATEGORIA[c]}
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
            <Icono nombre={ingrediente.categoria} />
            {ingrediente.nombre}
            {#if marcados.has(ingrediente.id)}
              <span class="marca"><Icono nombre="check" tamano={14} /></span>
            {/if}
          </button>
        {/each}
      </div>
    {:else if consulta.trim()}
      <p class="vacio">
        No hay ningún ingrediente que se llame «{consulta.trim()}» en el catálogo.
      </p>
    {:else}
      <p class="vacio">
        Todavía no hay ingredientes de {NOMBRE_CATEGORIA[categoria].toLocaleLowerCase('es')} en el catálogo.
      </p>
    {/if}

    {#if basicos.length > 0}
      <p class="basicos">{unirConY(basicos)}: damos por hecho que los tienes.</p>
    {/if}
  </section>

  <aside class="preferencias" aria-labelledby="titulo-preferencias">
    <h2 id="titulo-preferencias">Para tu receta</h2>
    <div class="scroll">
      <div class="porciones">
        <span id="etiqueta-porciones" class="nombre">Somos</span>
        <div class="contador" role="group" aria-labelledby="etiqueta-porciones">
          <button
            type="button"
            aria-label="Una porción menos"
            disabled={prefs.porciones <= PORCIONES_MIN}
            onclick={() => (prefs.porciones -= 1)}><Icono nombre="menos" /></button
          >
          <output aria-live="polite">{prefs.porciones}</output>
          <button
            type="button"
            aria-label="Una porción más"
            disabled={prefs.porciones >= PORCIONES_MAX}
            onclick={() => (prefs.porciones += 1)}><Icono nombre="mas" /></button
          >
        </div>
      </div>

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
            <Chip seleccionado={prefs.equipo.includes(e)} onclick={() => alternar(prefs.equipo, e)}
              >{NOMBRE_EQUIPO[e]}</Chip
            >
          {/each}
          {#if !todoElEquipo}
            <button type="button" class="mas" onclick={() => (todoElEquipo = true)}>Ver todo</button
            >
          {/if}
        </div>
        {#if prefs.equipo.length === 0}
          <p class="ayuda">Si no marcas nada, no filtramos por equipo.</p>
        {/if}
      </fieldset>
    </div>

    {#if app.error}<p class="error" role="alert">{app.error}</p>{/if}
    <Boton ancho disabled={app.ocupado} onclick={() => app.buscar()}>
      {marcadosElegibles === 0
        ? 'Ver recetas'
        : `Ver recetas con ${marcadosElegibles} ${marcadosElegibles === 1 ? 'ingrediente' : 'ingredientes'}`}
    </Boton>
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
  .saludo {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  h1 {
    font-size: 34px;
    line-height: 1.1;
  }
  .saludo p {
    margin: 6px 0 0;
    color: var(--color-tinta-suave);
  }
  .buscar {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
    background: var(--color-superficie);
    border: var(--borde) solid var(--color-borde-control);
    border-radius: var(--radio-pildora);
    padding: 0 var(--espacio-5);
    color: var(--color-tinta-suave);
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
    color: var(--color-tinta);
    min-height: 52px;
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
    gap: var(--espacio-3);
    flex-wrap: wrap;
  }
  .categoria {
    font: inherit;
    font-size: var(--texto-xs);
    font-weight: 600;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: none;
    border: 0;
    padding: 0;
    color: var(--color-tinta-suave);
    cursor: pointer;
    min-width: 64px;
  }
  .circulo {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--color-superficie);
    color: var(--color-tinta);
    border: var(--borde) solid var(--color-borde-control);
  }
  .categoria[aria-pressed='true'] {
    color: var(--color-tinta);
  }
  .categoria[aria-pressed='true'] .circulo {
    background: var(--color-acento);
    border: var(--trazo) solid var(--color-tinta);
  }
  .cuenta {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--radio-pildora);
    background: var(--color-tinta);
    color: var(--color-superficie);
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
    font-weight: 600;
    font-size: var(--texto-s);
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
    min-height: 56px;
    padding: var(--espacio-3) 36px var(--espacio-3) var(--espacio-4);
    border-radius: var(--radio-m);
    background: var(--color-superficie);
    color: var(--color-tinta);
    border: var(--borde) solid var(--color-borde-control);
    text-align: left;
    cursor: pointer;
  }
  .ficha :global(.icono) {
    color: var(--color-tinta-suave);
  }
  .ficha[aria-pressed='true'] {
    background: var(--color-acento-suave);
    border: var(--trazo) solid var(--color-tinta);
  }
  .marca {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-tinta);
    color: var(--color-superficie);
    display: grid;
    place-items: center;
  }
  .marca :global(.icono) {
    color: var(--color-superficie);
    stroke-width: 3;
  }
  .vacio,
  .basicos {
    margin: 0;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }

  .preferencias {
    background: var(--color-superficie);
    border: var(--borde) solid var(--color-separador);
    border-radius: var(--radio-xl);
    padding: var(--espacio-5);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
    min-height: 0;
  }
  .preferencias h2 {
    font-size: var(--texto-l);
  }
  .scroll {
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
    padding: 4px;
    margin: -4px;
  }
  .porciones {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .nombre,
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
    min-width: 2ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .contador button {
    width: var(--alto-control);
    height: var(--alto-control);
    border-radius: 50%;
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
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

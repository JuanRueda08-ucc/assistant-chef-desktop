<script lang="ts">
  import { escalarReceta } from '@shared/recetas/escalado'
  import { unirLista } from '@shared/recetas/lista'
  import { NOMBRE_DIFICULTAD } from '@shared/textos'
  import type { EvaluacionReceta } from '@shared/types/busqueda'
  import type { ResumenReceta } from '@shared/types/ipc'
  import type { Receta } from '@shared/types/receta'
  import { app } from '../estado/app.svelte'
  import { ingredientesConEstado, textoDescarte } from '../lib/disponibilidad-receta'
  import { fotoDe } from '../lib/fotos'
  import Icono from './Icono.svelte'

  // Desplegable de «Para inspirarte hoy» en Inicio (tarea 45, variante 1 elegida por el autor el
  // 2026-11-08): sube sobre el saludo con lo que tienes, lo que te falta y los básicos. Lo que se
  // muestra lo calcula main con las reglas de la búsqueda (alergias, dieta y sustituciones).
  interface Props {
    receta: ResumenReceta
    /** Posición de la foto pulsada (0 a 3), para que la flecha la señale. */
    posicion: number
    oncerrar: () => void
  }
  let { receta, posicion, oncerrar }: Props = $props()

  // raw: escalarReceta copia la receta con structuredClone y un proxy no se puede copiar.
  let completa = $state.raw<Receta | null>(null)
  let evaluacion = $state.raw<EvaluacionReceta | null>(null)
  let error = $state<string | null>(null)
  $effect(() => {
    const id = receta.id
    completa = null
    evaluacion = null
    error = null
    Promise.all([
      window.api.recetas.obtener(id),
      window.api.recetas.evaluar({ recetaId: id, preferencias: $state.snapshot(app.preferencias) })
    ])
      .then(([r, e]) => {
        if (receta.id !== id) return
        completa = r
        evaluacion = e
        if (!r || !e) error = 'No encontré esta receta.'
      })
      .catch(() => {
        if (receta.id === id) error = 'No pude revisar esta receta. Inténtalo de nuevo.'
      })
  })

  const porciones = $derived(app.preferencias.porciones)
  const foto = $derived(fotoDe(receta.imagen))
  const lista = $derived(
    completa && evaluacion
      ? ingredientesConEstado(
          escalarReceta(completa, porciones).receta,
          evaluacion.ok ? evaluacion.resultado.faltantes : [],
          app.catalogoCompleto,
          app.preferencias
        )
      : []
  )
  const tienes = $derived(lista.filter((i) => i.estado === 'tienes'))
  const faltan = $derived(lista.filter((i) => i.estado === 'falta'))
  const basicos = $derived(
    unirLista(
      lista.filter((i) => i.estado === 'basico').map((i) => i.nombre.toLocaleLowerCase('es'))
    )
  )
  const opcionales = $derived(
    unirLista(
      lista.filter((i) => i.estado === 'opcional').map((i) => i.nombre.toLocaleLowerCase('es'))
    )
  )
  const resumen = $derived.by(() => {
    if (!evaluacion?.ok) return null
    const { faltantes, ingredientesObligatorios } = evaluacion.resultado
    return faltantes.length === 0
      ? 'Tienes todo'
      : `Te ${faltantes.length === 1 ? 'falta' : 'faltan'} ${faltantes.length} de ${ingredientesObligatorios}`
  })

  let cerrar: HTMLButtonElement | undefined = $state()
  $effect(() => {
    cerrar?.focus()
  })

  function preguntarAlChef(): void {
    const nombres = unirLista(faltan.map((i) => i.nombre.toLocaleLowerCase('es')))
    app.abrirConversacion()
    void app.enviarChat(
      `Quiero hacer ${receta.titulo.toLocaleLowerCase('es')} y me falta ${nombres}. ¿Con qué lo sustituyo?`
    )
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && oncerrar()} />

<button type="button" class="velo" aria-label="Cerrar la receta" tabindex="-1" onclick={oncerrar}
></button>
<section
  id="desplegable-receta"
  class="desplegable"
  aria-labelledby="titulo-desplegable"
  style:--posicion={posicion}
>
  <div class="imagen">
    {#if foto}<img src={foto.url} alt="" />{/if}
  </div>

  <div class="columna">
    <h2 id="titulo-desplegable">{receta.titulo}</h2>
    <ul class="meta" aria-label="Datos de la receta">
      <li><Icono nombre="reloj" tamano={18} />{receta.tiempoTotalMin} min</li>
      <li><Icono nombre="nivel" tamano={18} />{NOMBRE_DIFICULTAD[receta.dificultad]}</li>
      <li>
        <Icono nombre="personas" tamano={18} />{porciones}
        {porciones === 1 ? 'porción' : 'porciones'}
      </li>
    </ul>
    {#if resumen}<p class="resumen" class:completa={resumen === 'Tienes todo'}>{resumen}</p>{/if}
    {#if !completa && !error}
      <p class="estado">Revisando tu despensa…</p>
    {:else if lista.length}
      <div class="lista">
        <h3>Lo que tienes <span class="n">{tienes.length}</span></h3>
        {#if tienes.length}
          <ul>
            {#each tienes as i (i.id)}
              <li>
                <span class="marca si"><Icono nombre="check" tamano={14} /></span>
                <span class="nombre">{i.nombre}</span><span class="cantidad">{i.detalle}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="estado">Nada todavía. Márcalo en tu despensa.</p>
        {/if}
      </div>
    {/if}
  </div>

  <div class="columna">
    {#if error}
      <p class="aviso" role="alert">{error}</p>
    {:else if lista.length}
      <div class="lista">
        <h3>Te falta <span class="n">{faltan.length}</span></h3>
        {#if faltan.length}
          <ul>
            {#each faltan as i (i.id)}
              <li>
                <span class="marca no"><Icono nombre="cerrar" tamano={14} /></span>
                <span class="nombre"
                  >{i.nombre}{#each i.sustituciones.slice(0, 1) as s (s.sustitucionId)}<small
                      >Puedes usar {s.nombreDestino.toLocaleLowerCase('es')}</small
                    >{/each}</span
                ><span class="cantidad">{i.detalle}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="estado">Nada. ¡Tienes todo!</p>
        {/if}
      </div>
      {#if opcionales}<p class="nota"><b>Opcional:</b> {opcionales}.</p>{/if}
      {#if basicos}<p class="nota"><b>Básicos que doy por hechos:</b> {basicos}.</p>{/if}
      {#if evaluacion && !evaluacion.ok && completa}
        <p class="aviso" role="status">
          <b>No te la propongo.</b>
          {textoDescarte(evaluacion.motivos, completa, app.preferencias)}
        </p>
      {/if}
    {/if}
    <div class="acciones">
      <button
        type="button"
        class="principal"
        disabled={!evaluacion?.ok}
        onclick={() => evaluacion?.ok && app.elegirDesdeInicio(evaluacion.resultado)}
        ><Icono nombre="olla" />Elegir y cocinar</button
      >
      {#if evaluacion?.ok && faltan.length > 0}
        <button type="button" class="secundario" onclick={preguntarAlChef}
          >Preguntar al chef por lo que falta</button
        >
      {/if}
    </div>
  </div>

  <button
    type="button"
    class="cerrar"
    aria-label="Cerrar la receta"
    bind:this={cerrar}
    onclick={oncerrar}><Icono nombre="cerrar" /></button
  >
</section>

<style>
  .velo {
    position: absolute;
    inset: 0;
    z-index: 3;
    border: 0;
    padding: 0;
    background: rgba(29, 29, 27, 0.18);
    cursor: default;
    animation: aparecer 160ms ease-out;
  }
  .desplegable {
    --foto: 128px;
    position: absolute;
    z-index: 4;
    left: var(--espacio-6);
    right: var(--espacio-6);
    top: var(--espacio-2);
    bottom: calc(var(--foto) + var(--espacio-6) + var(--espacio-4));
    display: grid;
    grid-template-columns: minmax(180px, 0.8fr) 1fr 1fr;
    background: var(--color-superficie);
    border-radius: var(--radio-xl);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
    animation: subir 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  /* La flecha señala la foto pulsada: 130 px del título y cuatro columnas con 16 px entre ellas. */
  .desplegable::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: calc(
      130px + var(--espacio-4) + (100% - 130px - 4 * var(--espacio-4)) / 4 *
        (var(--posicion) + 0.5) + var(--espacio-4) * var(--posicion) - 13px
    );
    width: 26px;
    height: 26px;
    background: var(--color-superficie);
    transform: rotate(45deg);
  }
  @keyframes subir {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
  }
  @keyframes aparecer {
    from {
      opacity: 0;
    }
  }
  .imagen {
    overflow: hidden;
    border-radius: var(--radio-xl) 0 0 var(--radio-xl);
    background: var(--color-acento-suave);
  }
  .imagen img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .columna {
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
    padding: var(--espacio-5);
  }
  .columna + .columna {
    border-left: var(--borde) solid var(--color-separador);
    padding-top: calc(var(--espacio-5) + 44px);
  }
  h2 {
    font-size: var(--texto-xl);
    line-height: 1.05;
    padding-right: var(--espacio-2);
  }
  .meta {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2) var(--espacio-4);
    color: var(--color-tinta-suave);
    font-weight: 600;
  }
  .meta li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .resumen {
    align-self: flex-start;
    margin: 0;
    padding: 6px var(--espacio-3);
    border-radius: 10px;
    background: var(--color-acento-suave);
    font-weight: var(--peso-titulo);
    font-size: var(--texto-s);
  }
  .resumen.completa {
    background: var(--color-hierba-suave);
    color: var(--color-hierba);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: var(--espacio-2);
    margin-bottom: var(--espacio-2);
    font-size: var(--texto-m);
  }
  .n {
    padding: 1px var(--espacio-2);
    border-radius: 8px;
    background: var(--color-relleno);
    font-size: var(--texto-s);
  }
  .lista ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lista li {
    display: flex;
    align-items: flex-start;
    gap: var(--espacio-2);
    font-size: var(--texto-s);
  }
  .nombre {
    display: flex;
    flex-direction: column;
  }
  .nombre small {
    color: var(--color-hierba);
    font-weight: var(--peso-fuerte);
  }
  .cantidad {
    margin-left: auto;
    padding-left: var(--espacio-2);
    color: var(--color-tinta-suave);
    font-size: var(--texto-xs);
    text-align: right;
  }
  .marca {
    flex: none;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border-radius: 7px;
  }
  .marca.si {
    background: var(--color-hierba-suave);
    color: var(--color-hierba);
  }
  .marca.no {
    background: var(--color-relleno);
    color: var(--color-tinta);
  }
  .nota,
  .estado {
    margin: 0;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
    line-height: 1.4;
  }
  .aviso {
    margin: 0;
    padding: var(--espacio-3) var(--espacio-4);
    border-left: 4px solid var(--color-acento);
    border-radius: var(--radio-m);
    background: var(--color-acento-suave);
    font-size: var(--texto-s);
    line-height: 1.4;
  }
  .acciones {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
  }
  .acciones button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--espacio-2);
    min-height: 52px;
    padding: 0 var(--espacio-4);
    font: inherit;
    font-weight: var(--peso-fuerte);
    color: var(--color-tinta);
    border: 0;
    border-radius: var(--radio-boton);
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .principal {
    min-height: 60px;
    font-family: var(--fuente-titulo);
    font-size: var(--texto-l);
    background: var(--color-acento);
    box-shadow: var(--sombra-boton);
  }
  .secundario {
    background: var(--color-relleno);
  }
  .acciones button:not(:disabled):hover {
    transform: translateY(-2px);
  }
  .acciones button:disabled {
    opacity: 0.45;
    cursor: default;
    box-shadow: none;
  }
  .cerrar {
    position: absolute;
    top: var(--espacio-4);
    right: var(--espacio-4);
    width: var(--alto-control);
    height: var(--alto-control);
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radio-boton);
    background: var(--color-relleno);
    color: var(--color-tinta);
    cursor: pointer;
  }
</style>

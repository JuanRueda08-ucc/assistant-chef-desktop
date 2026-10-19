<script lang="ts" module>
  import { MAX_TEMPORIZADORES_ACTIVOS as MAX_ACTIVOS } from '@shared/ia/herramientas'
</script>

<script lang="ts">
  import {
    estaActivo,
    formatearDuracion,
    formatearReloj,
    restanteSeg
  } from '@shared/cocina/temporizadores'
  import { PORCIONES_MAX, PORCIONES_MIN } from '@shared/esquemas/sesion'
  import {
    ARGUMENTOS,
    type NombreHerramienta,
    type ResultadoHerramienta
  } from '@shared/ia/herramientas'
  import { cantidadesDelPaso } from '@shared/recetas/escalado'
  import type { OpcionSustitucion } from '@shared/types/busqueda'
  import type { Ingrediente, Tecnica } from '@shared/types/receta'
  import Avatar from '../componentes/Avatar.svelte'
  import Boton from '../componentes/Boton.svelte'
  import Chip from '../componentes/Chip.svelte'
  import Globo from '../componentes/Globo.svelte'
  import Icono from '../componentes/Icono.svelte'
  import Panel from '../componentes/Panel.svelte'
  import { app } from '../estado/app.svelte'
  import { describirIngrediente } from '../lib/medidas'
  import { ControlVoz, type EstadoVoz } from '../voz/control'

  const sesion = $derived(app.sesion)
  const faseVoz = $derived(sesion?.fase)
  let estadoVoz = $state<EstadoVoz>('apagado')
  let errorVoz = $state<string | null>(null)
  let confirmarVoz = $state<string | null>(null)
  const voz = new ControlVoz(window.api, {
    sesion: () => app.sesion,
    disponible: () => app.sesion?.fase === 'cocinar' && !app.ocupado,
    aplicar: async (llamada) => {
      const r = await app.aplicar(llamada.nombre, llamada.argumentos, llamada.confirmado)
      if (r?.ok && r.datos?.tecnica) {
        tecnica = r.datos.tecnica
        panel = 'tecnica'
      }
      if (r?.ok && r.datos?.opciones) {
        const argumentos = ARGUMENTOS.sustituir_ingrediente.safeParse(llamada.argumentos)
        if (argumentos.success)
          opciones = { ingredienteId: argumentos.data.ingredienteId, lista: r.datos.opciones }
        panel = 'ingredientes'
      }
      return r
    },
    decir: (texto) => app.decir(texto),
    temporizadores: () => abrirTemporizadores(),
    confirmar: (texto) => {
      confirmarVoz = texto
    },
    estado: (estado) => {
      estadoVoz = estado
    },
    error: (mensaje) => {
      errorVoz = mensaje
    }
  })
  $effect(() => {
    // Cerrar tracks, socket, worker y lector también al desmontar o llegar a la pantalla final.
    if (faseVoz !== 'cocinar') voz.detener()
    return () => voz.detener()
  })
  const receta = $derived(sesion?.recetaAdaptada ?? null)
  const total = $derived(receta?.pasos.length ?? 0)
  const paso = $derived(
    receta && sesion?.pasoActual ? (receta.pasos[sesion.pasoActual - 1] ?? null) : null
  )
  const esUltimo = $derived(sesion?.pasoActual === total)
  const catalogo = $derived(
    Object.fromEntries(app.catalogo.map((i) => [i.id, i])) as Record<string, Ingrediente>
  )

  const ingredientesPaso = $derived(
    receta && paso
      ? cantidadesDelPaso(receta, paso).map((c) => ({
          id: c.ingredienteRecetaId,
          ...describirIngrediente({
            cantidad: c.cantidad,
            unidad: c.unidad,
            ingrediente: catalogo[c.ingredienteId],
            idIngrediente: c.ingredienteId,
            preparacion: receta.ingredientes.find((i) => i.id === c.ingredienteRecetaId)
              ?.preparacion
          })
        }))
      : []
  )

  // Reloj de la interfaz: el restante se calcula con la hora, la sesión no cambia cada segundo.
  let ahora = $state(Date.now())
  $effect(() => {
    const intervalo = setInterval(() => (ahora = Date.now()), 1000)
    return () => clearInterval(intervalo)
  })
  const temporizadores = $derived(
    (sesion?.temporizadores ?? [])
      .filter((t) => t.estado !== 'cancelado')
      .map((t) => ({ ...t, restante: restanteSeg(t, ahora) }))
  )
  const activos = $derived(temporizadores.filter((t) => estaActivo(t)).length)
  const sugerido = $derived.by(() => {
    const propuesto = paso?.temporizador
    if (!propuesto) return null
    const etiqueta = propuesto.etiqueta.toLocaleLowerCase('es')
    const enMarcha = temporizadores.some(
      (t) => estaActivo(t) && t.etiqueta.toLocaleLowerCase('es') === etiqueta
    )
    return enMarcha ? null : propuesto
  })

  const textoGlobo = $derived(
    app.globo ??
      paso?.consejo ??
      (paso?.requiereConfirmacion
        ? 'Cuando termines este paso, pulsa «Listo, siguiente».'
        : 'Cuando quieras, seguimos.')
  )

  // --- Acciones: todas pasan por las herramientas del chef (igual que hará la voz). ---------

  const NAVEGACION: NombreHerramienta[] = ['avanzar_paso', 'retroceder_paso', 'ir_a_paso']

  async function accion(
    nombre: NombreHerramienta,
    argumentos: Record<string, unknown> = {}
  ): Promise<ResultadoHerramienta | null> {
    const resultado = await app.aplicar(nombre, argumentos)
    // Al cambiar de paso, el globo vuelve al consejo: el texto del paso ya está en grande.
    if (resultado?.ok && NAVEGACION.includes(nombre)) app.globo = null
    return resultado
  }

  function siguiente(): void {
    if (esUltimo) accion('terminar_receta')
    else accion('avanzar_paso')
  }

  function repetir(): void {
    void voz.repetir()
  }

  // --- Paneles bajo demanda --------------------------------------------------------------

  type NombrePanel = 'tecnica' | 'temporizadores' | 'ingredientes'
  let panel = $state<NombrePanel | null>(null)
  let tecnica = $state<Tecnica | null>(null)

  async function verTecnica(): Promise<void> {
    const r = await accion('mostrar_tecnica')
    if (r?.ok && r.datos?.tecnica) {
      tecnica = r.datos.tecnica
      panel = 'tecnica'
    }
  }

  let nuevaEtiqueta = $state('')
  let nuevosMinutos = $state(5)
  function abrirTemporizadores(): void {
    nuevaEtiqueta = sugerido?.etiqueta ?? ''
    nuevosMinutos = sugerido ? Math.round(sugerido.segundos / 60) : 5
    panel = 'temporizadores'
  }
  async function crearTemporizador(): Promise<void> {
    const r = await accion('iniciar_temporizador', {
      segundos: Math.round(nuevosMinutos * 60),
      etiqueta: nuevaEtiqueta.trim(),
      ...(paso && { pasoId: paso.id })
    })
    if (r?.ok) nuevaEtiqueta = ''
  }
  function ponerSugerido(): void {
    if (!sugerido || !paso) return
    accion('iniciar_temporizador', {
      segundos: sugerido.segundos,
      etiqueta: sugerido.etiqueta,
      pasoId: paso.id
    })
  }

  let opciones = $state<{ ingredienteId: string; lista: OpcionSustitucion[] } | null>(null)
  async function verOpciones(ingredienteId: string): Promise<void> {
    const r = await accion('sustituir_ingrediente', { ingredienteId })
    opciones = r?.ok ? { ingredienteId, lista: r.datos?.opciones ?? [] } : null
  }
  async function sustituir(ingredienteId: string, sustitutoId: string): Promise<void> {
    const r = await accion('sustituir_ingrediente', { ingredienteId, sustitutoId })
    if (r?.ok) opciones = null
  }

  function teclas(e: KeyboardEvent): void {
    if (panel || !paso || app.ocupado) return
    if (e.target instanceof HTMLInputElement) return
    if (e.key === 'ArrowRight') siguiente()
    if (e.key === 'ArrowLeft' && (sesion?.pasoActual ?? 1) > 1) accion('retroceder_paso')
  }
</script>

<svelte:window onkeydown={teclas} />

{#if sesion?.fase === 'terminado' && receta}
  <main class="final">
    <Avatar estado={app.avatar} tamano={320} />
    <div class="final-texto">
      <Globo cola="izquierda">
        <h1>¡Listo! Que aproveche.</h1>
        <p>
          Terminaste {receta.titulo.toLocaleLowerCase('es')} para {sesion.porciones}
          {sesion.porciones === 1 ? 'porción' : 'porciones'}: los {total} pasos.
        </p>
      </Globo>
      <Boton onclick={() => app.cocinarOtra()}>Cocinar otra receta</Boton>
    </div>
  </main>
{:else if receta && paso && sesion}
  <main class="cocinar">
    <header class="cabeza">
      <h1>{receta.titulo}</h1>
      <button
        type="button"
        class="porciones"
        onclick={() => {
          opciones = null
          panel = 'ingredientes'
        }}><Icono nombre="personas" />{sesion.porciones}</button
      >
      <ol class="progreso" aria-label="Paso {paso.orden} de {total}">
        {#each receta.pasos as p (p.id)}
          <li
            class:hecho={sesion.pasosHechos.includes(p.id) && p.orden !== paso.orden}
            class:actual={p.orden === paso.orden}
          >
            <button
              type="button"
              aria-label="Ir al paso {p.orden}"
              aria-current={p.orden === paso.orden ? 'step' : undefined}
              onclick={() => accion('ir_a_paso', { orden: p.orden })}
            ></button>
          </li>
        {/each}
      </ol>
      <div class="temporizadores">
        {#each temporizadores as t (t.id)}
          <button
            type="button"
            class="temp"
            class:listo={t.restante === 0}
            class:pausado={t.estado === 'pausado'}
            onclick={abrirTemporizadores}
          >
            <span
              class="anillo"
              style:--progreso="{t.duracionSeg > 0 ? (t.restante / t.duracionSeg) * 100 : 0}%"
            ></span>
            <span class="temp-texto">
              <small>{t.etiqueta}{t.estado === 'pausado' ? ', en pausa' : ''}</small>
              <b>{t.restante === 0 ? '¡Listo!' : formatearReloj(t.restante)}</b>
            </span>
          </button>
        {/each}
        <button
          type="button"
          class="temp nuevo"
          aria-label="Temporizadores"
          onclick={abrirTemporizadores}><Icono nombre="reloj" /></button
        >
      </div>
    </header>

    <div class="centro">
      <div class="zona-paso">
        <section class="paso" aria-live="polite">
          <div class="paso-num"><b>{paso.orden}</b>de {total}</div>
          <p class="paso-texto">{paso.texto}</p>
          {#if paso.senalHecho}
            <p class="senal"><Icono nombre="ojo" /><span>{paso.senalHecho}</span></p>
          {/if}
          {#if paso.seguridad}
            <p class="seguridad"><Icono nombre="aviso" /><span>{paso.seguridad}</span></p>
          {/if}
          {#if sugerido}
            <div>
              <Boton variante="secundario" onclick={ponerSugerido}>
                <Icono nombre="reloj" />
                Temporizador de {formatearDuracion(sugerido.segundos)} para {sugerido.etiqueta}
              </Boton>
            </div>
          {/if}
          {#if ingredientesPaso.length > 0}
            <ul class="paso-ing" aria-label="Ingredientes de este paso">
              {#each ingredientesPaso as ing (ing.id)}
                <li><b>{ing.nombre}</b><small>{ing.detalle}</small></li>
              {/each}
            </ul>
          {/if}
        </section>

        {#if panel === 'tecnica' && tecnica}
          <Panel titulo={tecnica.nombre} alCerrar={() => (panel = null)}>
            <p class="descripcion">{tecnica.descripcion}</p>
            <ol class="pasos-tecnica">
              {#each tecnica.pasosCortos as texto, i (i)}<li>{texto}</li>{/each}
            </ol>
          </Panel>
        {:else if panel === 'temporizadores'}
          <Panel titulo="Temporizadores" alCerrar={() => (panel = null)}>
            {#if temporizadores.length === 0}
              <p class="descripcion">No hay temporizadores en marcha.</p>
            {/if}
            <ul class="lista-temp">
              {#each temporizadores as t (t.id)}
                <li>
                  <span class="lt-nombre"
                    ><b>{t.etiqueta}</b><small
                      >{t.restante === 0
                        ? 'Terminado'
                        : t.estado === 'pausado'
                          ? `En pausa, quedan ${formatearReloj(t.restante)}`
                          : `Quedan ${formatearReloj(t.restante)}`}</small
                    ></span
                  >
                  {#if t.estado === 'corriendo' && t.restante > 0}
                    <Chip
                      onclick={() =>
                        accion('controlar_temporizador', { id: t.id, accion: 'pausar' })}
                      >Pausar</Chip
                    >
                  {:else if t.estado === 'pausado'}
                    <Chip
                      onclick={() =>
                        accion('controlar_temporizador', { id: t.id, accion: 'reanudar' })}
                      >Seguir</Chip
                    >
                  {/if}
                  <Chip
                    onclick={() =>
                      accion('controlar_temporizador', { id: t.id, accion: 'sumar', segundos: 60 })}
                    >+1 min</Chip
                  >
                  <Chip
                    onclick={() =>
                      accion('controlar_temporizador', { id: t.id, accion: 'cancelar' })}
                    >{t.restante === 0 ? 'Quitar' : 'Cancelar'}</Chip
                  >
                </li>
              {/each}
            </ul>
            {#if activos < MAX_ACTIVOS}
              <form
                class="nuevo-temp"
                onsubmit={(e) => {
                  e.preventDefault()
                  crearTemporizador()
                }}
              >
                <label
                  >Nombre<input
                    bind:value={nuevaEtiqueta}
                    maxlength="40"
                    required
                    placeholder="Pasta, horno…"
                  /></label
                >
                <label
                  >Minutos<input
                    type="number"
                    bind:value={nuevosMinutos}
                    min="1"
                    max="360"
                    required
                  /></label
                >
                <Boton>Poner temporizador</Boton>
              </form>
            {:else}
              <p class="descripcion">
                Ya hay {MAX_ACTIVOS} en marcha: cancela uno para poner otro.
              </p>
            {/if}
          </Panel>
        {:else if panel === 'ingredientes'}
          <Panel titulo="Ingredientes" alCerrar={() => (panel = null)}>
            <div class="porciones-panel">
              <span>Para</span>
              <div class="contador">
                <button
                  type="button"
                  aria-label="Una porción menos"
                  disabled={sesion.porciones <= PORCIONES_MIN || app.ocupado}
                  onclick={() => accion('cambiar_porciones', { porciones: sesion.porciones - 1 })}
                  ><Icono nombre="menos" /></button
                >
                <output>{sesion.porciones}</output>
                <button
                  type="button"
                  aria-label="Una porción más"
                  disabled={sesion.porciones >= PORCIONES_MAX || app.ocupado}
                  onclick={() => accion('cambiar_porciones', { porciones: sesion.porciones + 1 })}
                  ><Icono nombre="mas" /></button
                >
              </div>
              <span>{sesion.porciones === 1 ? 'porción' : 'porciones'}</span>
            </div>
            <ul class="lista-ing">
              {#each receta.ingredientes as ir (ir.id)}
                {@const d = describirIngrediente({
                  cantidad: ir.cantidad,
                  unidad: ir.unidad,
                  ingrediente: catalogo[ir.ingredienteId],
                  idIngrediente: ir.ingredienteId,
                  preparacion: ir.preparacion
                })}
                <li>
                  <span class="lt-nombre"
                    ><b>{d.nombre}{ir.opcional ? ' (opcional)' : ''}</b><small>{d.detalle}</small
                    ></span
                  >
                  <Chip onclick={() => verOpciones(ir.ingredienteId)}>Cambiar</Chip>
                  {#if opciones?.ingredienteId === ir.ingredienteId}
                    <div class="opciones">
                      {#each opciones.lista as o (o.sustitucionId)}
                        <Chip onclick={() => sustituir(ir.ingredienteId, o.ingredienteDestinoId)}
                          >Usar {o.nombreDestino.toLocaleLowerCase('es')}</Chip
                        >
                      {:else}
                        <small>No hay sustituciones revisadas para este ingrediente.</small>
                      {/each}
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          </Panel>
        {/if}
      </div>

      <div class="chef">
        <Globo cola="abajo"><span class="globo-texto">{textoGlobo}</span></Globo>
        <Avatar estado={app.avatar} escuchando={estadoVoz === 'escuchando'} tamano={230} />
        <div class="controles-voz">
          <Chip
            seleccionado={estadoVoz !== 'apagado'}
            onclick={() => (estadoVoz === 'apagado' ? voz.iniciar() : voz.detener())}
          >
            <Icono nombre="microfono" />{estadoVoz === 'apagado'
              ? 'Activar micrófono'
              : 'Apagar micrófono'}
          </Chip>
          {#if estadoVoz === 'local'}<Chip onclick={() => voz.activar()}>Hablar al chef</Chip>{/if}
          <small role="status"
            >{estadoVoz === 'local'
              ? 'Di «Chef» para preguntar, o «siguiente», «atrás», «repite»…'
              : estadoVoz === 'escuchando'
                ? 'Te escucho · hasta 8 segundos'
                : estadoVoz === 'iniciando'
                  ? 'Preparando el micrófono…'
                  : estadoVoz === 'pensando'
                    ? 'El chef está pensando…'
                    : estadoVoz === 'hablando'
                      ? 'El chef está hablando'
                      : 'Micrófono apagado'}</small
          >
          {#if confirmarVoz}
            <span>¿Dijiste «{confirmarVoz}»?</span>
            <Chip onclick={() => voz.confirmarOrden()}>Sí, ejecutar</Chip>
            <Chip
              onclick={() => {
                confirmarVoz = null
              }}>No</Chip
            >
          {/if}
          {#if errorVoz}<small role="alert">{errorVoz}</small>{/if}
        </div>
      </div>
    </div>

    {#if app.error}<p class="error" role="alert">{app.error}</p>{/if}
    <nav class="acciones" aria-label="Controles del paso">
      <button
        type="button"
        class="accion"
        disabled={sesion.pasoActual === 1 || app.ocupado}
        onclick={() => accion('retroceder_paso')}><Icono nombre="atras" tamano={28} />Atrás</button
      >
      <button type="button" class="accion" onclick={repetir}
        ><Icono nombre="repetir" tamano={28} />Repetir</button
      >
      <button
        type="button"
        class="accion"
        disabled={!paso.tecnicaId || app.ocupado}
        onclick={verTecnica}><Icono nombre="tecnica" tamano={28} />Ver técnica</button
      >
      <button type="button" class="accion principal" disabled={app.ocupado} onclick={siguiente}>
        {esUltimo ? 'Terminar receta' : 'Listo, siguiente'}<Icono nombre="siguiente" tamano={28} />
      </button>
    </nav>
  </main>
{:else}
  <main class="final">
    <Globo cola="izquierda"><h1>No hay ninguna receta en marcha</h1></Globo>
    <Boton onclick={() => app.irA('preparar')}>Elegir qué cocinar</Boton>
  </main>
{/if}

<style>
  .controles-voz {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--espacio-2);
    font-size: var(--texto-s);
    max-width: 340px;
  }
  .controles-voz small {
    flex-basis: 100%;
    text-align: center;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }
  .cocinar {
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 18px;
    padding: var(--espacio-1) var(--espacio-6) var(--espacio-5);
    min-height: 0;
  }
  .cabeza {
    display: flex;
    align-items: center;
    gap: var(--espacio-4);
    min-width: 0;
  }
  .cabeza h1 {
    font-size: var(--texto-l);
    white-space: nowrap;
  }
  .porciones {
    font: inherit;
    font-weight: var(--peso-fuerte);
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--alto-control);
    padding: 0 var(--espacio-4);
    border-radius: var(--radio-pildora);
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    color: var(--color-tinta);
    cursor: pointer;
  }
  .progreso {
    display: flex;
    gap: 6px;
    flex: 1;
    max-width: 420px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .progreso li {
    flex: 1;
  }
  .progreso button {
    width: 100%;
    height: 12px;
    padding: 0;
    border-radius: var(--radio-pildora);
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    cursor: pointer;
  }
  .progreso .hecho button {
    background: var(--color-tinta);
    border-color: var(--color-tinta);
  }
  .progreso .actual button {
    background: var(--color-acento);
    border: var(--trazo) solid var(--color-tinta);
  }
  .temporizadores {
    display: flex;
    gap: var(--espacio-2);
    margin-left: auto;
  }
  .temp {
    font: inherit;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 54px;
    padding: 6px var(--espacio-4) 6px 6px;
    border-radius: var(--radio-pildora);
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    color: var(--color-tinta);
    cursor: pointer;
    text-align: left;
  }
  .temp.nuevo {
    padding: 0;
    width: 54px;
    justify-content: center;
  }
  .temp.listo {
    border: var(--trazo) solid var(--color-tinta);
    background: var(--color-acento);
  }
  .anillo {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: conic-gradient(var(--color-acento) 0 var(--progreso), var(--color-panel-suave) 0);
    border: var(--borde) solid var(--color-tinta);
    display: grid;
    place-items: center;
  }
  .anillo::after {
    content: '';
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--color-superficie);
  }
  .temp.listo .anillo {
    background: var(--color-superficie);
  }
  .temp-texto small {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-tinta-suave);
  }
  .temp.listo .temp-texto small {
    color: var(--color-tinta);
  }
  .temp-texto b {
    font-family: var(--fuente-titulo);
    font-size: var(--texto-l);
    font-variant-numeric: tabular-nums;
  }
  .temp.pausado b {
    color: var(--color-tinta-suave);
  }

  .centro {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: var(--espacio-5);
    min-height: 0;
  }
  .zona-paso {
    position: relative;
    min-height: 0;
  }
  .paso {
    height: 100%;
    background: var(--color-superficie);
    border: var(--borde) solid var(--color-separador);
    border-radius: var(--radio-xl);
    padding: 28px 34px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
  }
  .paso-num {
    display: flex;
    align-items: baseline;
    gap: var(--espacio-3);
    color: var(--color-tinta-suave);
    font-weight: 600;
  }
  .paso-num b {
    font-family: var(--fuente-titulo);
    font-size: var(--texto-numero);
    line-height: 0.8;
    color: var(--color-tinta);
  }
  .paso-texto {
    font-family: var(--fuente-titulo);
    font-size: var(--texto-paso);
    line-height: 1.18;
    font-weight: 600;
    margin: 0;
    max-width: 26ch;
  }
  .senal,
  .seguridad {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin: 0;
    font-size: 19px;
    color: var(--color-tinta-suave);
  }
  .seguridad {
    color: var(--color-tinta);
    background: var(--color-acento-suave);
    border: var(--borde) solid var(--color-tinta);
    border-radius: var(--radio-m);
    padding: var(--espacio-3) var(--espacio-4);
    font-size: var(--texto-m);
  }
  .paso-ing {
    list-style: none;
    margin: auto 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: var(--espacio-3);
  }
  .paso-ing li {
    background: var(--color-fondo);
    border: var(--borde) solid var(--color-separador);
    border-radius: var(--radio-m);
    padding: 14px var(--espacio-4);
  }
  .paso-ing b {
    display: block;
    font-family: var(--fuente-titulo);
    font-size: 22px;
  }
  .paso-ing small {
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }

  .chef {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: var(--espacio-3);
    padding-bottom: var(--espacio-2);
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-top: var(--espacio-1);
  }
  .chef :global(.globo) {
    align-self: stretch;
    margin-bottom: var(--espacio-2);
  }
  .globo-texto {
    font-size: 19px;
    font-weight: 600;
  }

  .acciones {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1.6fr;
    gap: 14px;
  }
  .accion {
    font: inherit;
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-l);
    min-height: var(--alto-boton-cocina);
    border-radius: var(--radio-l);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--espacio-3);
    background: var(--color-superficie);
    color: var(--color-tinta);
    border: var(--trazo) solid var(--color-tinta);
    cursor: pointer;
  }
  .accion.principal {
    background: var(--color-acento);
    font-size: 26px;
  }
  .accion:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .error {
    margin: 0;
    font-size: var(--texto-s);
    border-left: 4px solid var(--color-acento);
    padding-left: var(--espacio-3);
  }

  /* Paneles */
  .descripcion {
    margin: 0 0 var(--espacio-4);
    font-size: var(--texto-m);
    line-height: 1.5;
    max-width: 60ch;
  }
  .pasos-tecnica {
    margin: 0;
    padding-left: 1.4em;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
    font-size: 22px;
    line-height: 1.35;
  }
  .lista-temp,
  .lista-ing {
    list-style: none;
    margin: 0 0 var(--espacio-5);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
  }
  .lista-temp li,
  .lista-ing li {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--espacio-2);
    padding-bottom: var(--espacio-3);
    border-bottom: var(--borde) solid var(--color-separador);
  }
  .lt-nombre {
    flex: 1;
    min-width: 200px;
    display: flex;
    flex-direction: column;
  }
  .lt-nombre b {
    font-size: var(--texto-m);
  }
  .lt-nombre small {
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }
  .opciones {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
    align-items: center;
  }
  .opciones small {
    color: var(--color-tinta-suave);
  }
  .nuevo-temp {
    display: flex;
    align-items: flex-end;
    gap: var(--espacio-3);
    flex-wrap: wrap;
  }
  .nuevo-temp label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
  }
  .nuevo-temp input {
    font: inherit;
    min-height: 52px;
    padding: 0 var(--espacio-4);
    border-radius: var(--radio-m);
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    color: var(--color-tinta);
    width: 220px;
  }
  .nuevo-temp input[type='number'] {
    width: 110px;
  }
  .porciones-panel {
    display: flex;
    align-items: center;
    gap: var(--espacio-4);
    font-weight: var(--peso-fuerte);
    margin-bottom: var(--espacio-4);
  }
  .contador {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
  }
  .contador output {
    font-family: var(--fuente-titulo);
    font-size: 28px;
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

  /* Final */
  .final {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--espacio-6);
    padding: var(--espacio-6);
  }
  .final-texto {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espacio-5);
    max-width: 520px;
  }
  .final h1 {
    font-size: var(--texto-xl);
  }
  .final p {
    margin: var(--espacio-2) 0 0;
    color: var(--color-tinta-suave);
    font-size: var(--texto-m);
  }
</style>

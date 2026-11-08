<script lang="ts">
  import { NOMBRE_DIFICULTAD } from '@shared/textos'
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import Icono from '../componentes/Icono.svelte'
  import { app } from '../estado/app.svelte'
  import { etiquetasVigentes, hayCambios, textoFaltan } from '../lib/conversacion'
  import { fotoDe } from '../lib/fotos'
  import { DictadoChat } from '../voz/hablar-chat.svelte'

  // Conversación con el chef a pantalla completa (tarea 44, opción A «Chat centrado», elegida por el
  // autor el 2026-11-08). Usa el mismo turno de chat, herramientas y reglas que el panel lateral:
  // lo que se ve (etiquetas y tarjetas) sale del estado de la app, no de lo que diga el modelo.
  const SUGERENCIAS = [
    { texto: 'Tengo pollo y arroz', icono: 'olla' },
    { texto: 'Algo rápido para 2', icono: 'reloj' },
    { texto: 'Sorpréndeme', icono: 'chispa' }
  ] as const
  /** Recetas guardadas que se muestran en la conversación; el resto, en Elegir. */
  const MAX_GUARDADAS = 3

  let texto = $state('')
  let entrada: HTMLInputElement | undefined = $state()
  let hilo: HTMLDivElement | undefined = $state()
  const dictado = new DictadoChat()
  $effect(() => () => dictado.detener())
  $effect(() => {
    entrada?.focus()
  })
  // Cada mensaje nuevo, estado o error queda a la vista.
  $effect(() => {
    void [
      app.conversacion.length,
      app.chatOcupado,
      app.chatError,
      app.ideasCargando,
      dictado.estado,
      app.confirmacionIngredientes
    ]
    if (hilo) hilo.scrollTop = hilo.scrollHeight
  })

  const ocupado = $derived(app.chatOcupado || app.ocupado)
  const despensa = $derived(app.preferencias)
  const ultimoConRecetas = $derived(app.conversacion.findLastIndex((t) => t.recetas))
  const guardadas = $derived((app.busqueda?.resultados ?? []).slice(0, MAX_GUARDADAS))
  const masGuardadas = $derived(Math.max(0, (app.busqueda?.resultados.length ?? 0) - MAX_GUARDADAS))
  const ideas = $derived(app.ideas?.lista ?? [])
  /** Si la despensa cambió después de buscar, las tarjetas ya no valen hasta buscar otra vez. */
  const recetasVigentes = $derived(app.busqueda !== null && app.puedeIrA('elegir'))
  /** El último turno ya ofrece «Buscar recetas con esto»: no se repite «Buscar de nuevo». */
  const ofreceBuscar = $derived.by(() => {
    const ultimo = app.conversacion.at(-1)
    if (!ultimo || ultimo.recetas) return false
    const e = etiquetasVigentes(ultimo.cambios, despensa)
    return e.ingredientes.length > 0 || e.sinIdentificar.length > 0
  })

  const nombreDe = (id: string): string =>
    app.catalogoCompleto.find((i) => i.id === id)?.nombre ?? id

  async function enviar(consulta: string): Promise<void> {
    consulta = consulta.trim()
    if (!consulta || ocupado) return
    texto = ''
    await app.enviarChat(consulta)
    if (app.chatError && !texto) texto = consulta
  }

  function deshacer(cambios: { ingredientes: string[]; sinIdentificar: string[] }): void {
    for (const id of cambios.ingredientes) app.quitarIngrediente({ id })
    for (const libre of cambios.sinIdentificar) app.quitarIngrediente({ libre })
  }
</script>

<main class="conversacion">
  <nav class="historial" aria-label="Tus chats con el chef">
    <button
      type="button"
      class="nuevo"
      disabled={app.chatOcupado || app.conversacion.length === 0}
      onclick={() => app.nuevaConversacion()}><Icono nombre="mas" />Nuevo chat</button
    >
    {#if app.chats.length}
      <h2>Tus chats</h2>
      <ul>
        {#each app.chats as chat (chat.id)}
          <li class:actual={chat.id === app.chatActualId}>
            <button
              type="button"
              class="abrir"
              aria-current={chat.id === app.chatActualId ? 'true' : undefined}
              disabled={app.chatOcupado && chat.id !== app.chatActualId}
              title={chat.titulo}
              onclick={() => app.abrirChat(chat.id)}>{chat.titulo}</button
            >
            <button
              type="button"
              class="borrar"
              aria-label="Borrar el chat «{chat.titulo}»"
              title="Borrar"
              disabled={app.chatOcupado}
              onclick={() => app.borrarChat(chat.id)}><Icono nombre="cerrar" tamano={16} /></button
            >
          </li>
        {/each}
      </ul>
    {:else}
      <p class="sin-chats">Aquí aparecerán tus chats, cada uno con su nombre.</p>
    {/if}
  </nav>

  <div class="chat">
    <div class="hilo" bind:this={hilo} aria-live="polite" aria-label="Conversación con el chef">
      <div class="columna">
        {#if app.conversacion.length === 0 && !app.preguntaPendiente}
          <section class="vacio" aria-labelledby="titulo-conversacion">
            <ChefBlob pose="hablando" tamano={170} />
            <h1 id="titulo-conversacion">¿Qué cocinamos hoy?</h1>
            <p>Cuéntame qué tienes, para cuántos y cuánto tiempo. Yo te propongo recetas.</p>
          </section>
        {/if}

        {#each app.conversacion as turno, n (n)}
          {@const etiquetas = etiquetasVigentes(turno.cambios, despensa)}
          {#if turno.pregunta}<p class="yo">{turno.pregunta}</p>{/if}
          <div class="chef">
            <ChefBlob pose="busto" tamano={46} />
            <div class="cuerpo">
              <p>{turno.respuesta}</p>

              {#if hayCambios(etiquetas)}
                <ul class="etiquetas" aria-label="Lo que añadí a tu despensa">
                  {#each etiquetas.ingredientes as id (id)}
                    <li>
                      {nombreDe(id)}
                      <button
                        type="button"
                        aria-label="Quitar {nombreDe(id)}"
                        disabled={ocupado}
                        onclick={() => app.quitarIngrediente({ id })}
                        ><Icono nombre="cerrar" tamano={14} /></button
                      >
                    </li>
                  {/each}
                  {#each etiquetas.sinIdentificar as libre (libre)}
                    <li class="libre" title="Fuera del catálogo: alérgenos sin verificar">
                      {libre}
                      <button
                        type="button"
                        aria-label="Quitar {libre}"
                        disabled={ocupado}
                        onclick={() => app.quitarIngrediente({ libre })}
                        ><Icono nombre="cerrar" tamano={14} /></button
                      >
                    </li>
                  {/each}
                  {#if etiquetas.porciones !== null}
                    <li class="porciones">
                      <Icono nombre="personas" tamano={18} />Para {etiquetas.porciones}
                    </li>
                  {/if}
                </ul>
                {#if etiquetas.ingredientes.length || etiquetas.sinIdentificar.length}
                  <p class="apunte">
                    <Icono nombre="check" tamano={18} />Añadido a tu despensa ·
                    <button
                      type="button"
                      class="enlace"
                      disabled={ocupado}
                      onclick={() => deshacer(etiquetas)}>Deshacer</button
                    >
                  </p>
                  {#if n === app.conversacion.length - 1 && !turno.recetas}
                    <button
                      type="button"
                      class="accion"
                      disabled={ocupado}
                      onclick={() => void app.buscarDesdeConversacion()}
                      ><Icono nombre="buscar" />Buscar recetas con esto</button
                    >
                  {/if}
                {/if}
              {/if}

              {#if turno.recetas && n === ultimoConRecetas}
                {#if !recetasVigentes}
                  {#if !ofreceBuscar}
                    <div class="aviso">
                      <p>Cambió tu despensa o tus preferencias después de buscar.</p>
                      <button
                        type="button"
                        class="accion"
                        disabled={ocupado}
                        onclick={() => void app.buscarDesdeConversacion()}
                        ><Icono nombre="repetir" />Buscar de nuevo</button
                      >
                    </div>
                  {/if}
                {:else}
                  {#if guardadas.length || ideas.length}
                    <ul class="tarjetas" aria-label="Recetas propuestas">
                      {#each guardadas as r (r.receta.id)}
                        {@const foto = fotoDe(r.receta.imagen)}
                        <li class="tarjeta">
                          <span class="foto">
                            {#if foto}<img src={foto.url} alt="" />{:else}<ChefBlob
                                pose="hablando"
                                tamano={92}
                              />{/if}
                            <span class="origen"
                              >{r.receta.origen === 'generada'
                                ? 'De Mis recetas'
                                : r.receta.estadoRevision === 'borrador'
                                  ? 'Guardada · sin revisar'
                                  : 'Guardada'}</span
                            >
                          </span>
                          <span class="info">
                            <b>{r.receta.titulo}</b>
                            <span class="meta"
                              >{r.receta.tiempoTotalMin} min · {NOMBRE_DIFICULTAD[
                                r.receta.dificultad
                              ].toLocaleLowerCase('es')}</span
                            >
                            <span class="faltan" class:completa={r.faltantes.length === 0}
                              >{textoFaltan(r.faltantes.length)}</span
                            >
                            <button
                              type="button"
                              class="ver"
                              onclick={() => app.verEnElegir({ recetaId: r.receta.id })}
                              >Ver receta</button
                            >
                          </span>
                        </li>
                      {/each}
                      {#each ideas as idea (idea.id)}
                        {@const imagen = app.recetasDeIdeas[idea.id]?.receta.imagen}
                        <li class="tarjeta">
                          <span class="foto idea">
                            {#if imagen}<img src={imagen} alt="" />{:else}<ChefBlob
                                pose="hablando"
                                tamano={92}
                              />{/if}
                            <span class="origen">Idea del chef</span>
                          </span>
                          <span class="info">
                            <b>{idea.titulo}</b>
                            <span class="meta">{idea.tiempoTotalMin} min</span>
                            <span class="faltan" class:completa={idea.faltan.length === 0}
                              >{textoFaltan(idea.faltan.length)}</span
                            >
                            <button
                              type="button"
                              class="ver"
                              onclick={() => app.verEnElegir({ ideaId: idea.id })}
                              >Ver receta</button
                            >
                          </span>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                  {#if app.ideasCargando}
                    <p class="estado">El chef está pensando ideas…</p>
                  {:else if app.ideasError}
                    <p class="error" role="alert">{app.ideasError}</p>
                  {/if}
                  <div class="fila">
                    <button
                      type="button"
                      class="accion"
                      disabled={ocupado || app.ideasCargando}
                      onclick={() => void app.proponerIdeas()}
                      ><Icono nombre="repetir" />Dame otras</button
                    >
                    {#if masGuardadas > 0}
                      <button
                        type="button"
                        class="accion suave"
                        onclick={() => app.verTodasEnElegir()}
                        >Ver las {masGuardadas + MAX_GUARDADAS} en Elegir</button
                      >
                    {/if}
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        {/each}

        {#if app.confirmacionIngredientes}
          <div class="fila" role="group" aria-label="Qué hacer con los ingredientes">
            <button
              type="button"
              class="accion principal"
              onclick={() => void app.resolverIngredientes('reemplazar')}
              >Reemplazar mi selección</button
            >
            <button
              type="button"
              class="accion"
              onclick={() => void app.resolverIngredientes('anadir')}>Añadir a mi selección</button
            >
          </div>
        {/if}
        {#if app.preguntaPendiente}<p class="yo">{app.preguntaPendiente}</p>{/if}
        {#if app.chatOcupado}
          <div class="chef pensando" role="status">
            <ChefBlob pose="busto" tamano={46} />
            <p>
              <span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>El chef está
              pensando…
            </p>
          </div>
        {/if}
        {#if dictado.estado === 'escuchando'}
          <p class="estado" role="status">Te escucho. El micrófono se apaga solo al terminar.</p>
        {:else if dictado.estado === 'entendiendo'}
          <p class="estado" role="status">Entendiendo lo que dijiste…</p>
        {/if}
        {#if app.chatError}<p class="error" role="alert">{app.chatError}</p>{/if}
        {#if dictado.error}<p class="error" role="alert">{dictado.error}</p>{/if}
      </div>
    </div>

    <div class="pie">
      {#if app.conversacion.length === 0 && !app.chatOcupado && !app.preguntaPendiente}
        <div class="sugerencias" aria-label="Frases para empezar">
          {#each SUGERENCIAS as s (s.texto)}
            <button type="button" disabled={ocupado} onclick={() => void enviar(s.texto)}
              ><Icono nombre={s.icono} />{s.texto}</button
            >
          {/each}
        </div>
      {/if}
      <form
        class="campo"
        onsubmit={(evento) => {
          evento.preventDefault()
          void enviar(texto)
        }}
      >
        <label for="mensaje-conversacion" class="oculto">Mensaje para el chef</label>
        <input
          id="mensaje-conversacion"
          type="text"
          bind:this={entrada}
          bind:value={texto}
          placeholder="Escribe al chef: lo que tienes, cuántos son, cuánto tiempo…"
          maxlength="2000"
          autocomplete="off"
          disabled={app.chatOcupado}
        />
        <button
          type="button"
          class="hablar"
          class:escuchando={dictado.estado === 'escuchando'}
          disabled={dictado.estado !== 'apagada' || ocupado}
          onclick={() => void dictado.hablar((t) => app.enviarChat(t))}
          ><Icono nombre="microfono" />{dictado.estado === 'escuchando'
            ? 'Escuchando'
            : 'Hablar'}</button
        >
        <button
          type="submit"
          class="enviar"
          aria-label={app.chatOcupado ? 'Consultando' : 'Enviar'}
          title="Enviar"
          disabled={!texto.trim() || ocupado}><Icono nombre="enviar" /></button
        >
      </form>
      {#if app.chatSimulado}<p class="nota">Modo de prueba: el chef responde sin Gemini.</p>{/if}
    </div>
  </div>
</main>

<style>
  .conversacion {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    gap: var(--espacio-5);
    padding: 0 var(--espacio-6) var(--espacio-5);
  }
  /* Lista de chats, como en los asistentes de conversación (pedido del autor, 2026-11-08). */
  .historial {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
    padding: var(--espacio-4);
    background: var(--color-superficie);
    border-radius: var(--radio-l);
    overflow: hidden;
  }
  .nuevo {
    display: inline-flex;
    align-items: center;
    gap: var(--espacio-2);
    min-height: var(--alto-control);
    padding: 0 var(--espacio-4);
    font: inherit;
    font-weight: var(--peso-fuerte);
    color: var(--color-tinta);
    background: var(--color-acento);
    box-shadow: var(--sombra-boton);
    border: 0;
    border-radius: var(--radio-boton);
    cursor: pointer;
  }
  .nuevo:disabled {
    box-shadow: none;
  }
  .historial h2 {
    margin: var(--espacio-3) 0 0;
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
  }
  .historial ul {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .historial li {
    display: flex;
    align-items: center;
    border-radius: var(--radio-boton);
    transition: background-color var(--transicion);
  }
  .historial li:hover {
    background: var(--color-relleno);
  }
  .historial li.actual {
    background: var(--color-acento-suave);
    box-shadow: inset 0 0 0 var(--trazo) var(--color-tinta);
  }
  .abrir {
    flex: 1;
    min-width: 0;
    min-height: var(--alto-control);
    padding: 0 var(--espacio-3);
    font: inherit;
    font-size: var(--texto-s);
    font-weight: 600;
    text-align: left;
    color: var(--color-tinta);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .historial li.actual .abrir {
    font-weight: var(--peso-fuerte);
  }
  .borrar {
    flex: none;
    width: 36px;
    height: 36px;
    margin-right: 4px;
    display: grid;
    place-items: center;
    color: var(--color-tinta-suave);
    background: none;
    border: 0;
    border-radius: 10px;
    cursor: pointer;
    opacity: 0;
  }
  .historial li:hover .borrar,
  .historial li.actual .borrar,
  .borrar:focus-visible {
    opacity: 1;
  }
  .borrar:hover {
    background: var(--color-superficie);
    color: var(--color-tinta);
  }
  .sin-chats {
    margin: var(--espacio-2) 0 0;
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
    line-height: 1.4;
  }
  .chat {
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .pensando p {
    display: inline-flex;
    align-items: center;
    gap: var(--espacio-2);
    margin: 0;
    padding-top: var(--espacio-3);
    color: var(--color-tinta-suave);
  }
  .puntos {
    display: inline-flex;
    gap: 4px;
  }
  .puntos i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-tinta-suave);
    animation: puntos 1.2s ease-in-out infinite;
  }
  .puntos i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .puntos i:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes puntos {
    0%,
    60%,
    100% {
      opacity: 0.3;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-4px);
    }
  }
  .hilo {
    overflow-y: auto;
    min-height: 0;
  }
  .columna,
  .pie {
    width: min(820px, 100%);
    margin: 0 auto;
  }
  .columna {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
    padding: var(--espacio-2) 0 var(--espacio-4);
    overflow-wrap: anywhere;
  }
  .vacio {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: var(--espacio-3);
  }
  .vacio h1 {
    font-size: 42px;
    line-height: 1.05;
  }
  .vacio p {
    margin: 0;
    color: var(--color-tinta-suave);
    font-size: var(--texto-m);
  }
  .yo {
    align-self: flex-end;
    max-width: 70%;
    margin: 0;
    padding: var(--espacio-3) var(--espacio-5);
    background: var(--color-acento);
    border-radius: var(--radio-l) var(--radio-l) 6px var(--radio-l);
    font-size: 19px;
    font-weight: 600;
    animation: aparecer 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .chef {
    display: flex;
    gap: var(--espacio-3);
    align-items: flex-start;
    animation: aparecer 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes aparecer {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .cuerpo {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espacio-3);
    padding-top: var(--espacio-2);
    font-size: 19px;
    line-height: 1.4;
  }
  .cuerpo > p {
    margin: 0;
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
    display: inline-flex;
    align-items: center;
    gap: var(--espacio-2);
    min-height: 44px;
    padding: 0 6px 0 var(--espacio-4);
    background: var(--color-superficie);
    border-radius: var(--radio-boton);
    font-size: var(--texto-m);
    font-weight: var(--peso-fuerte);
  }
  .etiquetas li.libre {
    border: var(--borde) dashed var(--color-borde-control);
  }
  .etiquetas li.porciones {
    padding-right: var(--espacio-4);
    background: var(--color-acento-suave);
  }
  .etiquetas li button {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 10px;
    background: var(--color-relleno);
    color: var(--color-tinta);
    cursor: pointer;
  }
  .apunte {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--color-hierba);
    font-size: var(--texto-s);
    font-weight: var(--peso-fuerte);
  }
  .enlace {
    font: inherit;
    color: var(--color-tinta);
    text-decoration: underline;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .accion {
    display: inline-flex;
    align-items: center;
    gap: var(--espacio-2);
    min-height: 48px;
    padding: 0 var(--espacio-5);
    font: inherit;
    font-size: var(--texto-m);
    font-weight: var(--peso-fuerte);
    color: var(--color-tinta);
    background: var(--color-superficie);
    border: 0;
    border-radius: var(--radio-boton);
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .accion.suave {
    background: var(--color-relleno);
  }
  .accion.principal {
    background: var(--color-acento);
    box-shadow: var(--sombra-boton);
  }
  .accion:not(:disabled):hover {
    transform: translateY(-2px);
  }
  button:disabled {
    cursor: default;
    opacity: 0.45;
  }
  .fila {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .aviso {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espacio-2);
  }
  .aviso p {
    margin: 0;
    color: var(--color-tinta-suave);
  }
  .tarjetas {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--espacio-3);
  }
  .tarjeta {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-superficie);
    border-radius: var(--radio-l);
  }
  .foto {
    position: relative;
    height: 116px;
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
  .origen {
    position: absolute;
    left: var(--espacio-2);
    top: var(--espacio-2);
    padding: 3px var(--espacio-2);
    background: var(--color-superficie);
    border-radius: 8px;
    font-size: 12px;
    font-weight: var(--peso-titulo);
  }
  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--espacio-3) var(--espacio-4) var(--espacio-4);
    font-size: var(--texto-s);
    line-height: 1.3;
  }
  .info b {
    font-family: var(--fuente-titulo);
    font-size: 18px;
    line-height: 1.15;
  }
  .meta {
    color: var(--color-tinta-suave);
  }
  .faltan {
    font-weight: var(--peso-titulo);
    color: var(--color-tinta);
  }
  .faltan.completa {
    color: var(--color-hierba);
  }
  .ver {
    margin-top: auto;
    min-height: 44px;
    font: inherit;
    font-weight: var(--peso-fuerte);
    color: var(--color-tinta);
    background: var(--color-relleno);
    border: 0;
    border-radius: var(--radio-boton);
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .ver:hover {
    transform: translateY(-1px);
  }
  .estado {
    margin: 0;
    color: var(--color-tinta-suave);
  }
  .error {
    margin: 0;
    padding: var(--espacio-3) var(--espacio-4);
    background: var(--color-superficie);
    border-left: 4px solid var(--color-acento);
    border-radius: var(--radio-m);
  }
  .sugerencias {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--espacio-2);
    margin-bottom: var(--espacio-3);
  }
  .sugerencias button {
    display: inline-flex;
    align-items: center;
    gap: var(--espacio-2);
    min-height: 50px;
    padding: 0 var(--espacio-4);
    font: inherit;
    font-size: var(--texto-m);
    font-weight: var(--peso-fuerte);
    color: var(--color-tinta);
    background: var(--color-superficie);
    border: 0;
    border-radius: var(--radio-m);
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .sugerencias button:not(:disabled):hover {
    transform: translateY(-2px);
  }
  .campo {
    display: flex;
    align-items: center;
    gap: var(--espacio-2);
    padding: var(--espacio-2) var(--espacio-2) var(--espacio-2) var(--espacio-5);
    background: var(--color-superficie);
    border-radius: var(--radio-l);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.07);
  }
  input {
    flex: 1;
    min-width: 0;
    min-height: 52px;
    border: 0;
    padding: 0;
    font: inherit;
    font-size: 18px;
    color: var(--color-tinta);
    background: transparent;
  }
  input:focus-visible {
    outline: none;
  }
  .campo:focus-within {
    box-shadow:
      0 0 0 var(--trazo) var(--color-tinta),
      0 6px 20px rgba(0, 0, 0, 0.07);
  }
  input::placeholder {
    color: var(--color-tinta-suave);
  }
  .hablar,
  .enviar {
    flex: none;
    height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--espacio-2);
    border: 0;
    border-radius: var(--radio-m);
    font: inherit;
    font-weight: var(--peso-fuerte);
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .hablar {
    padding: 0 var(--espacio-4);
    background: var(--color-tinta);
    color: var(--color-superficie);
  }
  .hablar.escuchando {
    background: var(--color-acento);
    color: var(--color-tinta);
    opacity: 1;
    animation: latido 1.2s ease-in-out infinite;
  }
  @keyframes latido {
    50% {
      transform: scale(1.05);
    }
  }
  .enviar {
    width: 52px;
    background: var(--color-acento);
    color: var(--color-tinta);
    box-shadow: var(--sombra-boton);
  }
  .hablar:not(:disabled):hover,
  .enviar:not(:disabled):hover {
    transform: translateY(-2px);
  }
  .nota {
    margin: var(--espacio-2) 0 0;
    text-align: center;
    font-size: var(--texto-xs);
    color: var(--color-tinta-suave);
  }
  .oculto {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>

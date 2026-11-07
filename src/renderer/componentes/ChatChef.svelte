<script lang="ts">
  import { app } from '../estado/app.svelte'
  import { dictar } from '../voz/dictado'
  import Boton from './Boton.svelte'
  import Icono from './Icono.svelte'

  // Chat con el chef en un panel lateral que se abre desde la cabecera ("Escribir al chef"),
  // para que no compita con el contenido de cada pantalla (docs/replanteamiento-v1.md).
  let texto = $state('')
  let entrada: HTMLInputElement | undefined = $state()
  const terminado = $derived(app.pantalla === 'cocinar' && app.sesion?.fase === 'terminado')
  const placeholder = $derived(
    app.pantalla === 'cocinar'
      ? '¿Cómo sé que está listo? Cambia a 2 porciones…'
      : 'Tengo pollo y arroz, somos 2 y tengo 30 minutos…'
  )
  $effect(() => {
    if (app.chatAbierto) entrada?.focus()
  })
  // Cada mensaje nuevo, estado o error debe quedar a la vista.
  let mensajes: HTMLDivElement | undefined = $state()
  $effect(() => {
    void [app.conversacion.length, app.chatOcupado, app.chatError]
    if (mensajes) mensajes.scrollTop = mensajes.scrollHeight
  })

  // «Hablar» (0020): solo fuera de Cocinar, que tiene su propio micrófono. La frase se envía sola.
  const puedeHablar = $derived(app.pantalla !== 'cocinar')
  let voz = $state<'apagada' | 'escuchando' | 'entendiendo'>('apagada')
  let vozError = $state<string | null>(null)
  let controlVoz: AbortController | null = null
  const detenerVoz = (): void => controlVoz?.abort()
  $effect(() => {
    if (!app.chatAbierto || !puedeHablar) detenerVoz()
    return detenerVoz
  })
  async function hablar(): Promise<void> {
    if (voz !== 'apagada' || app.chatOcupado || app.ocupado) return
    vozError = null
    const control = new AbortController()
    controlVoz = control
    voz = 'escuchando'
    let pcm: ArrayBuffer | null = null
    try {
      await window.api.voz.dictadoIniciar({})
      pcm = await dictar(control.signal)
      if (!pcm && !control.signal.aborted) vozError = 'No te oí. Inténtalo de nuevo o escríbelo.'
    } catch {
      vozError = 'No pude abrir el micrófono. Revisa el permiso del sistema o escríbelo.'
    } finally {
      // El micrófono ya está cerrado; el permiso también se retira aunque esto falle.
      void window.api.voz.dictadoTerminar({}).catch(() => {})
    }
    if (!pcm || control.signal.aborted) {
      voz = 'apagada'
      return
    }
    voz = 'entendiendo'
    try {
      const r = await window.api.voz.transcribir(pcm)
      if (control.signal.aborted) return
      voz = 'apagada'
      if (r.ok) await app.enviarChat(r.texto)
      else vozError = r.mensaje
    } catch {
      vozError = 'No pude entender el audio. Inténtalo de nuevo o escríbelo.'
    } finally {
      voz = 'apagada'
    }
  }

  async function enviar(): Promise<void> {
    const consulta = texto.trim()
    if (!consulta || app.chatOcupado || app.ocupado) return
    texto = ''
    await app.enviarChat(consulta)
    if (app.chatError && !texto) texto = consulta
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && app.chatAbierto && (app.chatAbierto = false)}
/>

{#if app.chatAbierto}
  <div class="chat-chef" role="dialog" aria-modal="false" aria-labelledby="titulo-chat">
    <header>
      <h2 id="titulo-chat">Escribir al chef</h2>
      <button
        type="button"
        class="cerrar"
        aria-label="Cerrar el chat"
        onclick={() => (app.chatAbierto = false)}><Icono nombre="cerrar" /></button
      >
    </header>
    {#if app.chatSimulado}<p class="aviso">Modo de prueba: el chef responde sin Gemini.</p>{/if}
    <div class="mensajes" bind:this={mensajes} aria-live="polite" aria-label="Conversación">
      {#each app.conversacion as turno, i (i)}
        <p class="tu"><span class="quien">Tú</span>{turno.pregunta}</p>
        <p class="chef"><span class="quien">Chef</span>{turno.respuesta}</p>
      {:else}
        <p class="vacio">
          {app.pantalla === 'cocinar'
            ? 'Pregúntale por este paso, pide un temporizador o cambia las porciones.'
            : 'Dile qué tienes, para cuántos cocinas o qué te apetece, y busca recetas contigo.'}
        </p>
      {/each}
      {#if app.chatOcupado}<p class="estado">El chef está revisando tu petición…</p>{/if}
      {#if voz === 'escuchando'}
        <p class="estado" role="status">Te escucho. El micrófono se apaga solo al terminar.</p>
      {:else if voz === 'entendiendo'}
        <p class="estado" role="status">Entendiendo lo que dijiste…</p>
      {/if}
      {#if app.chatError}<p class="error" role="alert">{app.chatError}</p>{/if}
      {#if vozError}<p class="error" role="alert">{vozError}</p>{/if}
    </div>
    <form
      onsubmit={(evento) => {
        evento.preventDefault()
        void enviar()
      }}
    >
      <label for="mensaje-chef" class="oculto">Mensaje para el chef</label>
      <input
        id="mensaje-chef"
        type="text"
        bind:this={entrada}
        bind:value={texto}
        {placeholder}
        maxlength="2000"
        autocomplete="off"
        disabled={app.chatOcupado || terminado}
      />
      {#if puedeHablar}
        <Boton
          variante="secundario"
          disabled={voz !== 'apagada' || app.chatOcupado || app.ocupado}
          onclick={() => void hablar()}>{voz === 'escuchando' ? 'Escuchando…' : 'Hablar'}</Boton
        >
      {/if}
      <Boton
        disabled={!texto.trim() || app.chatOcupado || app.ocupado || terminado}
        onclick={() => void enviar()}>{app.chatOcupado ? 'Consultando…' : 'Enviar'}</Boton
      >
    </form>
  </div>
{/if}

<style>
  .chat-chef {
    position: fixed;
    top: 72px;
    right: var(--espacio-4);
    bottom: var(--espacio-4);
    z-index: 20;
    width: min(420px, calc(100vw - 2 * var(--espacio-4)));
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
    padding: var(--espacio-5);
    background: var(--color-superficie);
    border: var(--trazo) solid var(--color-tinta);
    border-radius: var(--radio-xl);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    font-size: var(--texto-l);
  }
  .cerrar {
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
  .aviso {
    margin: 0;
    font-size: var(--texto-xs);
    color: var(--color-tinta-suave);
  }
  .mensajes {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
    overflow-wrap: anywhere;
  }
  .mensajes p {
    margin: 0;
    padding: var(--espacio-3) var(--espacio-4);
    border-radius: var(--radio-m);
    font-size: var(--texto-s);
    line-height: 1.4;
  }
  .tu {
    align-self: flex-end;
    max-width: 85%;
    background: var(--color-acento-suave);
  }
  .chef {
    align-self: flex-start;
    max-width: 90%;
    background: var(--color-fondo);
    border: var(--borde) solid var(--color-separador);
  }
  .quien {
    display: block;
    font-size: var(--texto-xs);
    font-weight: var(--peso-fuerte);
    color: var(--color-tinta-suave);
  }
  .vacio,
  .estado {
    color: var(--color-tinta-suave);
  }
  .error {
    border-left: 4px solid var(--color-acento);
  }
  form {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--espacio-2);
  }
  input {
    flex: 1 0 100%;
    min-width: 0;
    min-height: var(--alto-control);
    border: var(--borde) solid var(--color-borde-control);
    border-radius: var(--radio-pildora);
    padding: var(--espacio-3) var(--espacio-4);
    font: inherit;
    font-size: var(--texto-s);
    color: var(--color-tinta);
    background: var(--color-superficie);
  }
  input::placeholder {
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

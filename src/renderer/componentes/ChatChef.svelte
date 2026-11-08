<script lang="ts">
  import busto from '../assets/chef/chef_busto.png'
  import { app } from '../estado/app.svelte'
  import { DictadoChat } from '../voz/hablar-chat.svelte'
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
  const dictado = new DictadoChat()
  const voz = $derived(dictado.estado)
  const vozError = $derived(dictado.error)
  $effect(() => {
    if (!app.chatAbierto || !puedeHablar) dictado.detener()
    return () => dictado.detener()
  })
  async function hablar(): Promise<void> {
    if (app.chatOcupado || app.ocupado) return
    await dictado.hablar((texto) => app.enviarChat(texto))
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
      <img class="cara" src={busto} alt="" />
      <h2 id="titulo-chat">El chef</h2>
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
        {#if turno.pregunta}<p class="tu"><span class="quien">Tú</span>{turno.pregunta}</p>{/if}
        <p class="chef"><span class="quien">Chef</span>{turno.respuesta}</p>
      {:else}
        <p class="vacio">
          {app.pantalla === 'cocinar'
            ? 'Pregúntale por este paso, pide un temporizador o cambia las porciones.'
            : 'Dile qué tienes, para cuántos cocinas o qué te apetece, y busca recetas contigo.'}
        </p>
      {/each}
      {#if app.chatOcupado}<p class="estado">El chef está revisando tu petición…</p>{/if}
      {#if app.confirmacionIngredientes}
        <div class="confirmar" role="group" aria-label="Qué hacer con los ingredientes">
          <Boton onclick={() => void app.resolverIngredientes('reemplazar')}
            >Reemplazar mi selección</Boton
          >
          <Boton variante="secundario" onclick={() => void app.resolverIngredientes('anadir')}
            >Añadir a mi selección</Boton
          >
        </div>
      {/if}
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
        <button
          type="button"
          class="icono"
          class:escuchando={voz === 'escuchando'}
          aria-label={voz === 'escuchando' ? 'Escuchando' : 'Hablar'}
          title="Hablar"
          disabled={voz !== 'apagada' || app.chatOcupado || app.ocupado}
          onclick={() => void hablar()}><Icono nombre="microfono" /></button
        >
      {/if}
      <button
        type="submit"
        class="icono enviar"
        aria-label={app.chatOcupado ? 'Consultando' : 'Enviar'}
        title="Enviar"
        disabled={!texto.trim() || app.chatOcupado || app.ocupado || terminado}
        ><Icono nombre="enviar" /></button
      >
    </form>
  </div>
{/if}

<style>
  .chat-chef {
    position: fixed;
    top: 76px;
    right: var(--espacio-4);
    bottom: var(--espacio-4);
    z-index: 20;
    width: min(420px, calc(100vw - 2 * var(--espacio-4)));
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
    padding: var(--espacio-5);
    background: var(--color-superficie);
    border-radius: var(--radio-xl);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
    animation: entrar 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
  }
  header h2 {
    flex: 1;
  }
  .cara {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-acento);
    object-fit: contain;
  }
  h2 {
    font-size: var(--texto-l);
  }
  .cerrar {
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
  .confirmar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  form {
    display: flex;
    gap: var(--espacio-2);
  }
  .icono {
    flex: none;
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radio-boton);
    background: var(--color-relleno);
    color: var(--color-tinta);
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .icono:not(:disabled):hover {
    transform: translateY(-2px);
  }
  .icono:not(:disabled):active {
    transform: translateY(1px);
  }
  .icono.escuchando {
    animation: latido 1.2s ease-in-out infinite;
  }
  @keyframes latido {
    50% {
      transform: scale(1.08);
    }
  }
  .icono.escuchando {
    background: var(--color-acento);
  }
  .icono.enviar {
    background: var(--color-tinta);
    color: var(--color-superficie);
    box-shadow: var(--sombra-boton);
  }
  .icono:disabled {
    cursor: default;
    opacity: 0.45;
    box-shadow: none;
  }
  input {
    flex: 1;
    min-width: 0;
    min-height: 52px;
    border: 0;
    border-radius: var(--radio-boton);
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

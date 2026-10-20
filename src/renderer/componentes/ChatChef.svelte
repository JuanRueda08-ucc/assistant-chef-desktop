<script lang="ts">
  import { app } from '../estado/app.svelte'
  import Boton from './Boton.svelte'
  let texto = $state('')
  const terminado = $derived(app.pantalla === 'cocinar' && app.sesion?.fase === 'terminado')
  const placeholder = $derived(
    app.pantalla === 'cocinar'
      ? '¿Cómo hago este paso? · Cambia a 2 porciones…'
      : 'Tengo pollo y arroz, somos 2 y tengo 30 minutos…'
  )
  async function enviar(): Promise<void> {
    const consulta = texto.trim()
    if (!consulta || app.chatOcupado || app.ocupado) return
    texto = ''
    await app.enviarChat(consulta)
    if (app.chatError && !texto) texto = consulta
  }
</script>

<footer class="chat-chef" aria-label="Escribir al chef">
  <form
    onsubmit={(evento) => {
      evento.preventDefault()
      void enviar()
    }}
  >
    <div class="etiqueta">
      <label for="mensaje-chef">Pregunta al chef</label>
      {#if app.conversacion.length}
        <details class="historial">
          <summary>Conversación{app.chatSimulado ? ' · Modo de prueba' : ''}</summary>
          <div class="mensajes" aria-label="Historial de la conversación">
            {#each app.conversacion as turno, i (i)}
              <p><strong>Tú:</strong> {turno.pregunta}</p>
              <p><strong>Chef:</strong> {turno.respuesta}</p>
            {/each}
          </div>
        </details>
      {/if}
    </div>
    <input
      id="mensaje-chef"
      type="text"
      bind:value={texto}
      {placeholder}
      maxlength="2000"
      autocomplete="off"
      disabled={app.chatOcupado || terminado}
    />
    <Boton
      variante="secundario"
      disabled={!texto.trim() || app.chatOcupado || app.ocupado || terminado}
      onclick={() => void enviar()}>{app.chatOcupado ? 'Consultando…' : 'Enviar'}</Boton
    >
  </form>
  <div class="estado" aria-live="polite">
    {#if app.chatError}<p role="alert">{app.chatError}</p>
    {:else if app.chatOcupado}<p>El chef está revisando tu petición…</p>{/if}
  </div>
</footer>

<style>
  .chat-chef {
    position: relative;
    border-top: var(--borde) solid var(--color-separador);
    padding: var(--espacio-2) var(--espacio-6);
    background: var(--color-fondo);
  }
  form {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
  }
  label {
    font-weight: var(--peso-fuerte);
    white-space: nowrap;
  }
  input {
    flex: 1;
    min-width: 0;
    min-height: var(--alto-control);
    border: var(--borde) solid var(--color-borde-control);
    border-radius: var(--radio-pildora);
    padding: var(--espacio-3) var(--espacio-4);
    font: inherit;
    color: var(--color-tinta);
    background: var(--color-superficie);
  }
  input::placeholder {
    color: var(--color-tinta-suave);
  }
  .historial {
    position: relative;
    z-index: 3;
  }
  summary {
    padding: var(--espacio-1) 0;
    cursor: pointer;
    font-size: var(--texto-xs);
    color: var(--color-tinta-suave);
  }
  .mensajes {
    position: absolute;
    bottom: calc(100% + var(--espacio-2));
    left: 0;
    width: min(650px, calc(100vw - 64px));
    max-height: 240px;
    overflow-y: auto;
    padding: var(--espacio-3) var(--espacio-4);
    overflow-wrap: anywhere;
    background: var(--color-superficie);
    border: var(--borde) solid var(--color-borde-control);
    border-radius: var(--radio-m);
  }
  .mensajes p {
    margin: var(--espacio-2) 0;
    font-size: var(--texto-s);
  }
  .estado p {
    margin: var(--espacio-1) 0 0;
    font-size: var(--texto-s);
  }
</style>

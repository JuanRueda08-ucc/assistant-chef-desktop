<script lang="ts">
  import { onMount } from 'svelte'
  import busto from './assets/chef/chef_busto.png'
  import Momentos from './componentes/Momentos.svelte'
  import ChatChef from './componentes/ChatChef.svelte'
  import { app } from './estado/app.svelte'
  import Cocinar from './pantallas/Cocinar.svelte'
  import Elegir from './pantallas/Elegir.svelte'
  import Preparar from './pantallas/Preparar.svelte'
  import Retomar from './pantallas/Retomar.svelte'

  onMount(() => {
    app.arrancar()
  })

  // En Retomar y en la pantalla final no hay nada sobre lo que el chef pueda actuar.
  const chatDisponible = $derived(
    !app.retomando && !(app.pantalla === 'cocinar' && app.sesion?.fase === 'terminado')
  )
</script>

<div class="app">
  <header class="barra">
    <div class="marca"><img src={busto} alt="" />Chef digital</div>
    <Momentos />
    <div class="derecha">
      {#if chatDisponible}
        <button
          type="button"
          class="abrir-chat"
          aria-expanded={app.chatAbierto}
          onclick={() => (app.chatAbierto = !app.chatAbierto)}
          >{app.chatAbierto ? 'Cerrar chat' : 'Escribir al chef'}</button
        >
      {/if}
    </div>
  </header>

  {#if app.pantalla === 'preparar'}
    <Preparar />
  {:else if app.pantalla === 'elegir'}
    <Elegir />
  {:else if app.retomando}
    <Retomar />
  {:else}
    <Cocinar />
  {/if}
  {#if chatDisponible}<ChatChef />{/if}
</div>

<style>
  .app {
    height: 100vh;
    display: grid;
    grid-template-rows: 72px minmax(0, 1fr);
    min-height: 0;
    overflow: hidden;
  }
  .barra {
    display: grid;
    grid-template-columns: 220px 1fr 220px;
    align-items: center;
    justify-items: center;
    padding: 0 var(--espacio-6);
  }
  .marca {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-titulo);
    font-size: 20px;
  }
  .marca img {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
  .derecha {
    justify-self: end;
  }
  .abrir-chat {
    font: inherit;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
    min-height: var(--alto-control);
    padding: 0 var(--espacio-4);
    border-radius: var(--radio-pildora);
    border: var(--trazo) solid var(--color-tinta);
    background: var(--color-superficie);
    color: var(--color-tinta);
    cursor: pointer;
  }
  .abrir-chat[aria-expanded='true'] {
    background: var(--color-acento);
  }
  .app > :global(main) {
    min-height: 0;
  }
</style>

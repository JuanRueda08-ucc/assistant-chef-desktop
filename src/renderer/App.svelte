<script lang="ts">
  import { onMount } from 'svelte'
  import busto from './assets/chef/chef_busto.png'
  import Momentos from './componentes/Momentos.svelte'
  import ChatChef from './componentes/ChatChef.svelte'
  import { app } from './estado/app.svelte'
  import Acceso from './pantallas/Acceso.svelte'
  import Cocinar from './pantallas/Cocinar.svelte'
  import Elegir from './pantallas/Elegir.svelte'
  import Preparar from './pantallas/Preparar.svelte'
  import Retomar from './pantallas/Retomar.svelte'

  onMount(() => {
    app.arrancar()
  })

  const usuario = $derived(app.cuenta?.usuario ?? null)
  // En Retomar y en la pantalla final no hay nada sobre lo que el chef pueda actuar.
  const chatDisponible = $derived(
    !!usuario && !app.retomando && !(app.pantalla === 'cocinar' && app.sesion?.fase === 'terminado')
  )
</script>

<div class="app">
  <header class="barra">
    <div class="marca"><img src={busto} alt="" />Chef digital</div>
    {#if usuario}<Momentos />{:else}<span></span>{/if}
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
      {#if usuario}
        <span class="usuario" title={usuario.email}>{usuario.nombre}</span>
        <button type="button" class="salir" onclick={() => app.salir()}>Salir</button>
      {/if}
    </div>
  </header>

  {#if !app.cuenta}
    <main></main>
  {:else if !usuario}
    <Acceso />
  {:else if app.pantalla === 'preparar'}
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
    grid-template-columns: 220px 1fr 360px;
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
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
  }
  .usuario {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
  }
  .salir {
    font: inherit;
    font-size: var(--texto-s);
    font-weight: 600;
    background: none;
    border: 0;
    color: var(--color-tinta);
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: var(--espacio-2) 0;
    cursor: pointer;
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

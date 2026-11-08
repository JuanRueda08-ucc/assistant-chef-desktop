<script lang="ts">
  import { onMount } from 'svelte'
  import { USUARIO_LOCAL } from '@shared/types/cuenta'
  import busto from './assets/chef/chef_busto.png'
  import Momentos from './componentes/Momentos.svelte'
  import ChatChef from './componentes/ChatChef.svelte'
  import { app } from './estado/app.svelte'
  import Acceso from './pantallas/Acceso.svelte'
  import Cocinar from './pantallas/Cocinar.svelte'
  import Elegir from './pantallas/Elegir.svelte'
  import MisRecetas from './pantallas/MisRecetas.svelte'
  import Preparar from './pantallas/Preparar.svelte'
  import Retomar from './pantallas/Retomar.svelte'

  onMount(() => {
    app.arrancar()
  })

  // Guarda la despensa, las preferencias y las alergias poco después de cada cambio.
  $effect(() => {
    if (!app.preferenciasCargadas) return
    const preferencias = $state.snapshot(app.preferencias)
    const espera = setTimeout(() => {
      window.api.preferencias.guardar(preferencias).catch((error: unknown) => {
        console.error('No se pudo guardar la despensa', error)
      })
    }, 300)
    return () => clearTimeout(espera)
  })

  const usuario = $derived(app.cuenta?.usuario ?? null)
  // En Retomar y en la pantalla final no hay nada sobre lo que el chef pueda actuar.
  const chatDisponible = $derived(
    !!usuario &&
      !app.verMisRecetas &&
      !app.retomando &&
      !(app.pantalla === 'cocinar' && app.sesion?.fase === 'terminado')
  )
</script>

<div class="app">
  <header class="barra">
    <div class="marca"><img src={busto} alt="" />Chef digital</div>
    {#if usuario}<Momentos />{:else}<span></span>{/if}
    <div class="derecha">
      {#if usuario && app.pantalla !== 'cocinar' && !app.verMisRecetas}
        <button type="button" class="mis-recetas" onclick={() => app.abrirMisRecetas()}
          >Mis recetas</button
        >
      {/if}
      {#if chatDisponible && app.pantalla !== 'cocinar'}
        <button
          type="button"
          class="abrir-chat"
          aria-expanded={app.chatAbierto}
          onclick={() => (app.chatAbierto = !app.chatAbierto)}
          ><img src={busto} alt="" />{app.chatAbierto
            ? 'Cerrar el chat'
            : 'Pregúntale al chef'}</button
        >
      {/if}
      <!-- Sin cuenta real (0018) no hay nombre ni «Salir» que mostrar. -->
      {#if usuario && usuario.id !== USUARIO_LOCAL.id}
        <span class="usuario" title={usuario.email}>{usuario.nombre}</span>
        <button type="button" class="salir" onclick={() => app.salir()}>Salir</button>
      {/if}
    </div>
  </header>

  {#if !app.cuenta}
    <main></main>
  {:else if !usuario}
    <Acceso />
  {:else if app.verMisRecetas}
    <MisRecetas />
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
  .mis-recetas {
    font: inherit;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
    min-height: var(--alto-control);
    padding: 0 var(--espacio-2);
    border: 0;
    background: transparent;
    color: var(--color-tinta);
    text-decoration: underline;
    cursor: pointer;
  }
  .abrir-chat {
    font: inherit;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-m);
    display: inline-flex;
    align-items: center;
    gap: var(--espacio-2);
    min-height: 50px;
    padding: 4px var(--espacio-5) 4px 4px;
    border: 0;
    border-radius: var(--radio-pildora);
    background: var(--color-tinta);
    color: var(--color-superficie);
    box-shadow: var(--sombra-boton);
    cursor: pointer;
  }
  .abrir-chat img {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--color-acento);
    object-fit: contain;
  }
  .abrir-chat[aria-expanded='true'] {
    background: var(--color-relleno);
    color: var(--color-tinta);
    box-shadow: none;
  }
  .app > :global(main) {
    min-height: 0;
  }
</style>

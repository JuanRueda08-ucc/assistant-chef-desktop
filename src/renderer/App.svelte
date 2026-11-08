<script lang="ts">
  import { onMount } from 'svelte'
  import busto from './assets/chef/chef_busto.png'
  import MenuLateral from './componentes/MenuLateral.svelte'
  import ChatChef from './componentes/ChatChef.svelte'
  import { app } from './estado/app.svelte'
  import Acceso from './pantallas/Acceso.svelte'
  import Cocinar from './pantallas/Cocinar.svelte'
  import Elegir from './pantallas/Elegir.svelte'
  import Inicio from './pantallas/Inicio.svelte'
  import Conversacion from './pantallas/Conversacion.svelte'
  import Icono from './componentes/Icono.svelte'
  import AvisoTemporizador from './componentes/AvisoTemporizador.svelte'
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

  // Los temporizadores avisan aunque se esté en otra pantalla.
  $effect(() => {
    const reloj = setInterval(() => app.revisarTemporizadores(Date.now()), 1000)
    return () => clearInterval(reloj)
  })

  const usuario = $derived(app.cuenta?.usuario ?? null)
  // En Retomar y en la pantalla final no hay nada sobre lo que el chef pueda actuar.
  const chatDisponible = $derived(
    !!usuario &&
      !app.enInicio &&
      !app.enConversacion &&
      !app.verMisRecetas &&
      !app.retomando &&
      !(app.pantalla === 'cocinar' && app.sesion?.fase === 'terminado')
  )
</script>

<div class="app">
  <header class="barra">
    <div class="marca">
      {#if usuario}
        <button
          type="button"
          class="abrir-menu"
          aria-label="Abrir el menú"
          aria-expanded={app.menuAbierto}
          onclick={() => (app.menuAbierto = true)}><span></span><span></span><span></span></button
        >
      {/if}
      <button type="button" class="ir-inicio" onclick={() => app.irAlInicio()}
        ><img src={busto} alt="" />Chef digital</button
      >
    </div>
    <span></span>
    <div class="derecha">
      {#if usuario && app.enConversacion && !app.verMisRecetas && app.conversacion.length > 0}
        <button
          type="button"
          class="nueva"
          disabled={app.chatOcupado}
          onclick={() => app.nuevaConversacion()}><Icono nombre="mas" />Nueva conversación</button
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
    </div>
  </header>

  {#if !app.cuenta}
    <main></main>
  {:else if !usuario}
    <Acceso />
  {:else if app.verMisRecetas}
    <MisRecetas />
  {:else if app.retomando}
    <Retomar />
  {:else if app.enInicio}
    <Inicio />
  {:else if app.enConversacion}
    <Conversacion />
  {:else if app.pantalla === 'preparar'}
    <Preparar />
  {:else if app.pantalla === 'elegir'}
    <Elegir />
  {:else}
    <Cocinar />
  {/if}
  {#if chatDisponible}<ChatChef />{/if}
  {#if usuario}<MenuLateral /><AvisoTemporizador />{/if}
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
    grid-template-columns: auto 1fr auto;
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
  .ir-inicio {
    display: flex;
    align-items: center;
    gap: 10px;
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .abrir-menu {
    width: var(--alto-control);
    height: var(--alto-control);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 4px;
    margin-right: var(--espacio-2);
    border: 0;
    border-radius: var(--radio-boton);
    background: var(--color-relleno);
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .abrir-menu:hover {
    transform: translateY(-1px);
  }
  .abrir-menu span {
    width: 20px;
    height: 2.5px;
    border-radius: 2px;
    background: var(--color-tinta);
  }
  .ir-inicio img {
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
  .nueva {
    display: inline-flex;
    align-items: center;
    gap: var(--espacio-2);
    min-height: var(--alto-control);
    padding: 0 var(--espacio-4);
    font: inherit;
    font-weight: var(--peso-fuerte);
    color: var(--color-tinta);
    background: var(--color-relleno);
    border: 0;
    border-radius: var(--radio-boton);
    cursor: pointer;
  }
  .nueva:disabled {
    opacity: 0.45;
    cursor: default;
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
    transition: transform var(--transicion);
  }
  .abrir-chat:hover {
    transform: translateY(-2px);
  }
  .abrir-chat:active {
    transform: translateY(1px);
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

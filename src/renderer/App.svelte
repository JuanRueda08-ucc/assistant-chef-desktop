<script lang="ts">
  import { onMount } from 'svelte'
  import busto from './assets/chef/chef_busto.png'
  import Momentos from './componentes/Momentos.svelte'
  import ChatChef from './componentes/ChatChef.svelte'
  import { app } from './estado/app.svelte'
  import Cocinar from './pantallas/Cocinar.svelte'
  import Elegir from './pantallas/Elegir.svelte'
  import Preparar from './pantallas/Preparar.svelte'

  onMount(() => {
    app.arrancar()
  })
</script>

<div class="app">
  <header class="barra">
    <div class="marca"><img src={busto} alt="" />Chef digital</div>
    <Momentos />
    <div class="hueco"></div>
  </header>

  {#if app.pantalla === 'preparar'}
    <Preparar />
  {:else if app.pantalla === 'elegir'}
    <Elegir />
  {:else}
    <Cocinar />
  {/if}
  <ChatChef />
</div>

<style>
  .app {
    height: 100vh;
    display: grid;
    grid-template-rows: 72px minmax(0, 1fr) auto;
    min-height: 0;
    overflow: hidden;
  }
  .barra {
    display: grid;
    grid-template-columns: 200px 1fr 200px;
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
  .app > :global(main) {
    min-height: 0;
  }
</style>

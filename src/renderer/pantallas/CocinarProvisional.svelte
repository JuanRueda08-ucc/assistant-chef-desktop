<script lang="ts">
  import Boton from '../componentes/Boton.svelte'
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import Globo from '../componentes/Globo.svelte'
  import { app } from '../estado/app.svelte'

  // Provisional hasta la tarea 12 (pantalla Cocinar): confirma que la sesión empezó.
  const receta = $derived(app.sesion?.recetaAdaptada ?? null)
</script>

<main class="cocinar">
  <div class="fila">
    <ChefBlob pose="hablando" tamano={220} />
    <Globo cola="izquierda">
      {#if receta && app.sesion}
        <h1>{receta.titulo}, para {app.sesion.porciones}</h1>
        <p>
          Vamos por el paso {app.sesion.pasoActual} de {receta.pasos.length}. La pantalla de cocina
          llega en la próxima tarea.
        </p>
      {:else}
        <h1>No hay ninguna receta en marcha</h1>
      {/if}
    </Globo>
  </div>
  <Boton variante="secundario" onclick={() => app.irA(app.busqueda ? 'elegir' : 'preparar')}
    >Elegir otra receta</Boton
  >
</main>

<style>
  .cocinar {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--espacio-5);
    padding: var(--espacio-6);
    max-width: 900px;
    margin: 0 auto;
  }
  .fila {
    display: flex;
    align-items: center;
    gap: var(--espacio-5);
  }
  h1 {
    font-size: var(--texto-xl);
  }
  p {
    margin: var(--espacio-2) 0 0;
    color: var(--color-tinta-suave);
  }
</style>

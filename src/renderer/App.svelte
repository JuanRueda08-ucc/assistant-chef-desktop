<script lang="ts">
  import { onMount } from 'svelte'
  import type { ResumenReceta } from '@shared/types/ipc'

  // Provisional: comprueba que el renderer lee recetas por IPC. Las pantallas Preparar, Elegir
  // y Cocinar reemplazan esto en las tareas 10 a 12.
  let recetas = $state<ResumenReceta[]>([])
  let error = $state<string | null>(null)

  onMount(async () => {
    try {
      recetas = await window.api.recetas.listar()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  })
</script>

<main>
  <h1>Chef digital</h1>
  {#if error}
    <p role="alert">No se pudieron cargar las recetas: {error}</p>
  {:else}
    <ul data-testid="recetas">
      {#each recetas as receta (receta.id)}
        <li>{receta.titulo} · {receta.porcionesBase} porciones · {receta.estadoRevision}</li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    min-height: 100vh;
    padding: 2rem;
    background: var(--color-fondo);
    color: var(--color-texto);
  }
</style>

<script lang="ts">
  import { app, type Pantalla } from '../estado/app.svelte'

  // Los tres momentos de la app. Es una secuencia real, por eso van numerados.
  const MOMENTOS: { pantalla: Pantalla; nombre: string }[] = [
    { pantalla: 'preparar', nombre: 'Preparar' },
    { pantalla: 'elegir', nombre: 'Elegir' },
    { pantalla: 'cocinar', nombre: 'Cocinar' }
  ]
</script>

<nav aria-label="Momentos">
  <ol>
    {#each MOMENTOS as momento, i (momento.pantalla)}
      <li>
        <button
          type="button"
          aria-current={!app.verMisRecetas && app.pantalla === momento.pantalla
            ? 'step'
            : undefined}
          disabled={app.pantalla !== momento.pantalla && !app.puedeIrA(momento.pantalla)}
          onclick={() => app.irA(momento.pantalla)}
        >
          <span class="numero">{i + 1}</span>{momento.nombre}
        </button>
      </li>
    {/each}
  </ol>
</nav>

<style>
  ol {
    display: flex;
    gap: var(--espacio-5);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  button {
    font: inherit;
    font-size: var(--texto-m);
    font-weight: var(--peso-fuerte);
    display: flex;
    align-items: center;
    gap: var(--espacio-2);
    padding: var(--espacio-2) 0;
    border: 0;
    border-bottom: 4px solid transparent;
    background: transparent;
    color: var(--color-tinta-suave);
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
  .numero {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--color-relleno);
    font-size: var(--texto-xs);
  }
  button[aria-current='step'] {
    color: var(--color-tinta);
    border-bottom-color: var(--color-acento);
  }
  button[aria-current='step'] .numero {
    background: var(--color-tinta);
    color: var(--color-superficie);
  }
</style>

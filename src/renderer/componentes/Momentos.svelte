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
          aria-current={app.pantalla === momento.pantalla ? 'step' : undefined}
          disabled={!app.puedeIrA(momento.pantalla)}
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
    gap: var(--espacio-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  button {
    font: inherit;
    font-size: var(--texto-s);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: var(--espacio-2);
    padding: 6px var(--espacio-4) 6px 6px;
    border-radius: var(--radio-pildora);
    border: var(--trazo) solid transparent;
    background: transparent;
    color: var(--color-tinta-suave);
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
    opacity: 0.6;
  }
  .numero {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--color-panel-suave);
    font-size: var(--texto-xs);
  }
  button[aria-current='step'] {
    background: var(--color-superficie);
    border-color: var(--color-tinta);
    color: var(--color-tinta);
  }
  button[aria-current='step'] .numero {
    background: var(--color-acento);
  }
</style>

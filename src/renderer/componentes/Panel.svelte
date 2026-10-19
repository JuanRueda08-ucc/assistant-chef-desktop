<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icono from './Icono.svelte'

  // Panel bajo demanda de Cocinar (técnica, temporizadores, ingredientes). Se abre sobre la zona
  // del paso y deja ver al chef; se cierra con el botón o con Escape.
  interface Props {
    titulo: string
    alCerrar: () => void
    children: Snippet
  }
  let { titulo, alCerrar, children }: Props = $props()

  let dialogo: HTMLElement | undefined = $state()
  $effect(() => {
    dialogo?.focus()
  })
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && alCerrar()} />

<div
  class="panel"
  role="dialog"
  aria-modal="false"
  aria-labelledby="titulo-panel"
  tabindex="-1"
  bind:this={dialogo}
>
  <header>
    <h2 id="titulo-panel">{titulo}</h2>
    <button type="button" class="cerrar" aria-label="Cerrar" onclick={alCerrar}
      ><Icono nombre="cerrar" /></button
    >
  </header>
  <div class="contenido">
    {@render children()}
  </div>
</div>

<style>
  .panel {
    position: absolute;
    inset: 0;
    z-index: 5;
    background: var(--color-superficie);
    border: var(--trazo) solid var(--color-tinta);
    border-radius: var(--radio-xl);
    padding: var(--espacio-5) var(--espacio-6);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
    outline: none;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--espacio-4);
  }
  h2 {
    font-size: 26px;
  }
  .cerrar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    color: var(--color-tinta);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .contenido {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>

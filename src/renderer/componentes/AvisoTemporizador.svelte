<script lang="ts">
  import { app } from '../estado/app.svelte'
  import Boton from './Boton.svelte'
  import ChefBlob from './ChefBlob.svelte'

  // Aviso cuando termina un temporizador, esté donde esté la persona. Sin voz de Gemini: un sonido
  // corto, este aviso y una notificación del sistema si la ventana no está a la vista.
  const aviso = $derived(app.avisos[0] ?? null)
  const fueraDeCocina = $derived(app.pantalla !== 'cocinar' || app.verMisRecetas || app.enInicio)
</script>

{#if aviso}
  <div class="aviso" role="alertdialog" aria-labelledby="titulo-aviso" aria-live="assertive">
    <ChefBlob pose="hablando" tamano={72} />
    <div class="texto">
      <h2 id="titulo-aviso">¡Ya! Terminó «{aviso.etiqueta}»</h2>
      <p>Revisa la olla o el horno antes de seguir.</p>
    </div>
    <div class="acciones">
      {#if fueraDeCocina && app.sesion?.fase === 'cocinar'}
        <Boton
          variante="secundario"
          onclick={() => {
            app.cerrarAviso(aviso.id)
            app.irA('cocinar')
          }}>Ir a la receta</Boton
        >
      {/if}
      <Boton onclick={() => app.cerrarAviso(aviso.id)}>Entendido</Boton>
    </div>
  </div>
{/if}

<style>
  .aviso {
    position: fixed;
    top: 84px;
    left: 50%;
    z-index: 40;
    transform: translateX(-50%);
    width: min(640px, calc(100vw - 2 * var(--espacio-4)));
    display: flex;
    align-items: center;
    gap: var(--espacio-4);
    padding: var(--espacio-4) var(--espacio-5);
    background: var(--color-superficie);
    border: var(--trazo) solid var(--color-tinta);
    border-radius: var(--radio-l);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
    animation: entrar 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translate(-50%, -16px);
    }
  }
  .texto {
    flex: 1;
  }
  h2 {
    font-size: var(--texto-l);
  }
  p {
    margin: 4px 0 0;
    color: var(--color-tinta-suave);
  }
  .acciones {
    display: flex;
    gap: var(--espacio-2);
  }
</style>

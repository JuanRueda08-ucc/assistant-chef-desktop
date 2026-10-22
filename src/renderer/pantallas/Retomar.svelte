<script lang="ts">
  import { estaActivo, formatearReloj, restanteSeg } from '@shared/cocina/temporizadores'
  import Boton from '../componentes/Boton.svelte'
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import { app } from '../estado/app.svelte'

  // Al abrir la app con una receta a medias: qué estabas cocinando, en qué paso ibas y una sola
  // acción principal para continuar. El micrófono no se abre aquí (decisión 0013).
  const sesion = $derived(app.sesion)
  const receta = $derived(sesion?.recetaAdaptada ?? null)
  const paso = $derived(
    receta && sesion?.pasoActual ? (receta.pasos[sesion.pasoActual - 1] ?? null) : null
  )
  const ahora = Date.now()
  const temporizadores = $derived(
    (sesion?.temporizadores ?? [])
      .filter((t) => estaActivo(t) || t.estado === 'terminado')
      .map((t) => ({ ...t, restante: restanteSeg(t, ahora) }))
  )
</script>

<main class="retomar">
  {#if receta && paso && sesion}
    <section class="tarjeta" aria-labelledby="titulo-retomar">
      <div class="cabeza">
        <ChefBlob pose="busto" tamano={88} />
        <div>
          <p class="antetitulo">Tienes una receta a medias</p>
          <h1 id="titulo-retomar">{receta.titulo}</h1>
          <p class="meta">
            Para {sesion.porciones}
            {sesion.porciones === 1 ? 'porción' : 'porciones'}
          </p>
        </div>
      </div>

      <div class="paso">
        <p class="paso-num">Ibas por el paso {paso.orden} de {receta.pasos.length}</p>
        <p class="paso-texto">{paso.texto}</p>
      </div>

      {#if temporizadores.length > 0}
        <ul class="temporizadores" aria-label="Temporizadores">
          {#each temporizadores as t (t.id)}
            <li>
              <b>{t.etiqueta}</b>
              {t.restante === 0
                ? 'terminado'
                : t.estado === 'pausado'
                  ? `en pausa, quedan ${formatearReloj(t.restante)}`
                  : `quedan ${formatearReloj(t.restante)}`}
            </li>
          {/each}
        </ul>
      {/if}

      <div class="acciones">
        <Boton onclick={() => app.continuarReceta()}>Continuar receta</Boton>
        <Boton variante="secundario" onclick={() => app.prepararOtra()}>Preparar otra receta</Boton>
      </div>
      <p class="nota">El micrófono sigue apagado; lo activas en Cocinar cuando quieras.</p>
    </section>
  {/if}
</main>

<style>
  .retomar {
    display: grid;
    place-items: center;
    padding: var(--espacio-6);
    overflow-y: auto;
  }
  .tarjeta {
    width: min(720px, 100%);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-5);
    padding: var(--espacio-6);
    background: var(--color-superficie);
    border: var(--borde) solid var(--color-separador);
    border-radius: var(--radio-xl);
  }
  .cabeza {
    display: flex;
    align-items: center;
    gap: var(--espacio-4);
  }
  .antetitulo,
  .meta,
  .nota {
    margin: 0;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }
  h1 {
    font-size: var(--texto-xl);
  }
  .paso {
    padding: var(--espacio-4) var(--espacio-5);
    background: var(--color-fondo);
    border-radius: var(--radio-m);
  }
  .paso-num {
    margin: 0 0 var(--espacio-2);
    font-weight: var(--peso-fuerte);
  }
  .paso-texto {
    margin: 0;
    font-family: var(--fuente-titulo);
    font-size: var(--texto-l);
    line-height: 1.25;
  }
  .temporizadores {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .temporizadores li {
    padding: var(--espacio-2) var(--espacio-4);
    border-radius: var(--radio-pildora);
    border: var(--borde) solid var(--color-borde-control);
    font-size: var(--texto-s);
  }
  .acciones {
    display: flex;
    gap: var(--espacio-3);
    flex-wrap: wrap;
  }
</style>

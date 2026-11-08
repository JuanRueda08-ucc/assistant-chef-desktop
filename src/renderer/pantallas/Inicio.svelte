<script lang="ts">
  import { USUARIO_LOCAL } from '@shared/types/cuenta'
  import Boton from '../componentes/Boton.svelte'
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import Icono from '../componentes/Icono.svelte'
  import { app } from '../estado/app.svelte'
  import { fotoDe } from '../lib/fotos'

  // Inicio (pedido del autor, 2026-11-08): desde aquí se empieza, se sigue una receta a medias o se
  // abre una guardada. Es la primera pantalla al abrir la app y la casita del menú.
  const usuario = $derived(app.cuenta?.usuario ?? null)
  const saludo = $derived(
    usuario && usuario.id !== USUARIO_LOCAL.id ? `¡Hola, ${usuario.nombre}!` : '¡Hola!'
  )
  const enCurso = $derived(app.sesion?.fase === 'cocinar' ? app.sesion : null)
  const despensa = $derived([
    ...app.catalogo
      .filter((i) => !i.esBasicoDespensa && app.preferencias.ingredientes.includes(i.id))
      .map((i) => i.nombre),
    ...app.preferencias.ingredientesSinIdentificar
  ])
  const guardadas = $derived(app.misRecetas.slice(0, 3))
</script>

<main class="inicio">
  <section class="bienvenida" aria-labelledby="titulo-inicio">
    <ChefBlob pose="hablando" tamano={150} />
    <div class="texto">
      <h1 id="titulo-inicio">{saludo} ¿Qué cocinamos hoy?</h1>
      <p>Dime qué tienes y te propongo recetas, o deja que el chef invente una.</p>
      <div class="acciones">
        <Boton onclick={() => app.irA('preparar')}>Empezar con lo que tengo</Boton>
        <Boton variante="oscuro" onclick={() => app.ideasDesdeInicio()}
          ><Icono nombre="chispa" />Pedir ideas al chef</Boton
        >
      </div>
    </div>
  </section>

  {#if enCurso?.recetaAdaptada}
    <section class="tarjeta en-curso" aria-labelledby="titulo-en-curso">
      <div>
        <h2 id="titulo-en-curso">Tienes una receta a medias</h2>
        <p>
          {enCurso.recetaAdaptada.titulo} · paso {enCurso.pasoActual} de {enCurso.recetaAdaptada
            .pasos.length}
        </p>
      </div>
      <Boton onclick={() => app.irA('cocinar')}>Seguir cocinando</Boton>
    </section>
  {/if}

  <div class="columnas">
    <section class="tarjeta" aria-labelledby="titulo-despensa">
      <div class="fila">
        <h2 id="titulo-despensa">Tu despensa</h2>
        <button type="button" class="enlace" onclick={() => app.irA('preparar')}>Editar</button>
      </div>
      {#if despensa.length > 0}
        <ul class="chips">
          {#each despensa.slice(0, 8) as nombre (nombre)}<li>{nombre}</li>{/each}
          {#if despensa.length > 8}<li class="mas">y {despensa.length - 8} más</li>{/if}
        </ul>
      {:else}
        <p class="vacio">Todavía no has añadido ingredientes.</p>
      {/if}
    </section>

    <section class="tarjeta" aria-labelledby="titulo-guardadas">
      <div class="fila">
        <h2 id="titulo-guardadas">Mis recetas</h2>
        {#if app.misRecetas.length > 0}
          <button type="button" class="enlace" onclick={() => app.abrirMisRecetas()}
            >Ver todas</button
          >
        {/if}
      </div>
      {#if guardadas.length > 0}
        <ul class="guardadas">
          {#each guardadas as { receta } (receta.id)}
            <li>
              <button type="button" onclick={() => app.abrirMisRecetas(receta.id)}>
                <span class="miniatura">
                  {#if fotoDe(receta.imagen)}<img
                      src={fotoDe(receta.imagen)!.url}
                      alt=""
                    />{:else}<ChefBlob pose="busto" tamano={48} />{/if}
                </span>
                <span class="nombre">{receta.titulo}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="vacio">Cuando termines una receta del chef, podrás guardarla aquí.</p>
      {/if}
    </section>
  </div>
</main>

<style>
  .inicio {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-5);
    padding: var(--espacio-2) var(--espacio-6) var(--espacio-6);
    min-height: 0;
    overflow-y: auto;
  }
  .bienvenida {
    display: flex;
    align-items: center;
    gap: var(--espacio-6);
    padding: var(--espacio-5) var(--espacio-6);
    background: var(--color-acento-suave);
    border-radius: var(--radio-xl);
  }
  h1 {
    font-size: 36px;
    line-height: 1.1;
  }
  .texto p {
    margin: var(--espacio-2) 0 var(--espacio-4);
    color: var(--color-tinta-suave);
    font-size: var(--texto-m);
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-3);
  }
  .tarjeta {
    background: var(--color-superficie);
    border-radius: var(--radio-l);
    padding: var(--espacio-5);
  }
  .en-curso {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--espacio-4);
    border: var(--trazo) solid var(--color-tinta);
  }
  .en-curso p {
    margin: 4px 0 0;
    color: var(--color-tinta-suave);
  }
  .columnas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--espacio-5);
  }
  h2 {
    font-size: var(--texto-l);
  }
  .fila {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--espacio-3);
  }
  .enlace {
    font: inherit;
    font-weight: var(--peso-fuerte);
    color: var(--color-tinta);
    background: none;
    border: 0;
    text-decoration: underline;
    cursor: pointer;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .chips li {
    padding: 6px var(--espacio-3);
    border-radius: var(--radio-m);
    background: var(--color-acento-suave);
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
  }
  .chips .mas {
    background: var(--color-relleno);
  }
  .guardadas {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
  }
  .guardadas button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
    padding: var(--espacio-2);
    font: inherit;
    font-weight: var(--peso-fuerte);
    text-align: left;
    color: var(--color-tinta);
    background: none;
    border: 0;
    border-radius: var(--radio-m);
    cursor: pointer;
    transition: background-color var(--transicion);
  }
  .guardadas button:hover {
    background: var(--color-relleno);
  }
  .miniatura {
    flex: none;
    width: 64px;
    height: 48px;
    border-radius: var(--radio-m);
    overflow: hidden;
    display: grid;
    place-items: center;
    background: var(--color-acento-suave);
  }
  .miniatura img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .vacio {
    margin: 0;
    color: var(--color-tinta-suave);
  }
</style>

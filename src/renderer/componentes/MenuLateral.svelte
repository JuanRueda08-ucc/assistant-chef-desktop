<script lang="ts">
  import { USUARIO_LOCAL } from '@shared/types/cuenta'
  import busto from '../assets/chef/chef_busto.png'
  import { app } from '../estado/app.svelte'
  import Icono from './Icono.svelte'

  // Menú lateral (decisión 0022): lo que no forma parte del paso a paso. Sustituye a los momentos
  // numerados de la cabecera, que hacían parecer una sola pantalla.
  const usuario = $derived(app.cuenta?.usuario ?? null)
  const sinCuenta = $derived(usuario?.id === USUARIO_LOCAL.id)
  const recetaEnCurso = $derived(
    app.sesion?.fase === 'cocinar' &&
      (app.pantalla !== 'cocinar' ||
        app.verMisRecetas ||
        app.enInicio ||
        app.enConversacion ||
        app.retomando)
      ? (app.sesion.recetaAdaptada?.titulo ?? null)
      : null
  )

  let panel: HTMLElement | undefined = $state()
  $effect(() => {
    if (app.menuAbierto) panel?.querySelector<HTMLElement>('button')?.focus()
  })
  const cerrar = (): void => {
    app.menuAbierto = false
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && app.menuAbierto && cerrar()} />

{#if app.menuAbierto}
  <button type="button" class="fondo" aria-label="Cerrar el menú" onclick={cerrar}></button>
  <nav class="menu" aria-label="Menú" bind:this={panel}>
    <div class="cabeza">
      <img src={busto} alt="" />
      <span>Chef digital</span>
      <button type="button" class="cerrar" aria-label="Cerrar el menú" onclick={cerrar}
        ><Icono nombre="cerrar" /></button
      >
    </div>

    <button
      type="button"
      class="opcion"
      aria-current={app.enInicio && !app.verMisRecetas && !app.enConversacion ? 'page' : undefined}
      onclick={() => app.irAlInicio()}><Icono nombre="casa" /><span>Inicio</span></button
    >

    <button
      type="button"
      class="opcion"
      aria-current={app.enConversacion && !app.verMisRecetas ? 'page' : undefined}
      onclick={() => app.abrirConversacion()}
      ><Icono nombre="microfono" /><span>Hablar con el chef</span></button
    >

    <button
      type="button"
      class="opcion"
      aria-current={!app.enInicio &&
      !app.enConversacion &&
      !app.verMisRecetas &&
      app.pantalla === 'preparar'
        ? 'page'
        : undefined}
      onclick={() => {
        cerrar()
        app.irA('preparar')
      }}><Icono nombre="despensa" /><span>Tu despensa</span></button
    >

    {#if recetaEnCurso}
      <button
        type="button"
        class="opcion destacada"
        onclick={() => {
          cerrar()
          app.cerrarMisRecetas()
          app.irA('cocinar')
        }}
        ><Icono nombre="olla" /><span>Seguir cocinando<small>{recetaEnCurso}</small></span></button
      >
    {/if}

    <button
      type="button"
      class="opcion"
      aria-current={app.verMisRecetas ? 'page' : undefined}
      onclick={() => {
        cerrar()
        app.abrirMisRecetas()
      }}><Icono nombre="tecnica" /><span>Mis recetas</span></button
    >

    <div class="tema" role="group" aria-label="Modo de color">
      <button
        type="button"
        aria-pressed={app.tema === 'claro'}
        onclick={() => app.cambiarTema('claro')}>☀ Claro</button
      >
      <button
        type="button"
        aria-pressed={app.tema === 'oscuro'}
        onclick={() => app.cambiarTema('oscuro')}>☾ Oscuro</button
      >
    </div>

    <section class="cuenta" aria-label="Mi cuenta">
      <button
        type="button"
        class="tarjeta"
        aria-current={app.verMiCuenta ? 'page' : undefined}
        onclick={() => app.abrirMiCuenta()}
      >
        <span class="inicial" aria-hidden="true"
          >{(usuario?.nombre || 'C').slice(0, 1).toUpperCase()}</span
        >
        <span class="quien"
          ><strong>{sinCuenta ? 'Sin cuenta' : usuario?.nombre}</strong><small
            >Ver mi cuenta ›</small
          ></span
        >
      </button>
      {#if usuario && !sinCuenta}
        <button
          type="button"
          class="salir"
          onclick={() => {
            cerrar()
            void app.salir()
          }}>Cerrar sesión</button
        >
      {/if}
    </section>
  </nav>
{/if}

<style>
  .fondo {
    position: fixed;
    inset: 0;
    z-index: 30;
    border: 0;
    padding: 0;
    background: rgba(29, 29, 27, 0.45);
    animation: aparecer 200ms ease-out;
  }
  .menu {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 31;
    width: min(340px, 86vw);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
    padding: var(--espacio-5) var(--espacio-4);
    background: var(--color-lateral);
    color: var(--color-lateral-texto);
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    animation: entrar 320ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  /* Círculo decorativo, como el del saludo. */
  .menu::after {
    content: '';
    position: absolute;
    width: 340px;
    height: 340px;
    border-radius: 50%;
    background: var(--color-lateral-suave);
    right: -170px;
    bottom: -110px;
    pointer-events: none;
  }
  .menu > :global(*) {
    position: relative;
    z-index: 1;
  }
  .menu > .opcion {
    animation: subir 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .menu > .opcion:nth-of-type(2) {
    animation-delay: 40ms;
  }
  .menu > .opcion:nth-of-type(3) {
    animation-delay: 80ms;
  }
  .menu > .opcion:nth-of-type(4) {
    animation-delay: 120ms;
  }
  .menu > .opcion:nth-of-type(5) {
    animation-delay: 160ms;
  }
  @keyframes entrar {
    from {
      transform: translateX(-100%);
    }
  }
  @keyframes aparecer {
    from {
      opacity: 0;
    }
  }
  .cabeza {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
    padding-bottom: var(--espacio-4);
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-titulo);
    font-size: var(--texto-l);
  }
  .cabeza img {
    width: 44px;
    height: 44px;
    object-fit: contain;
    border-radius: 50%;
    background: var(--color-escenario-circulo);
  }
  .cabeza span {
    flex: 1;
  }
  .cerrar {
    width: var(--alto-control);
    height: var(--alto-control);
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radio-boton);
    background: var(--color-lateral-suave);
    color: var(--color-lateral-texto);
    cursor: pointer;
  }
  .opcion {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
    width: 100%;
    min-height: 56px;
    padding: 0 var(--espacio-4);
    font: inherit;
    font-weight: var(--peso-titulo);
    font-size: var(--texto-m);
    text-align: left;
    color: var(--color-lateral-texto);
    background: transparent;
    border: 0;
    border-radius: var(--radio-m);
    cursor: pointer;
    transition:
      background-color var(--transicion),
      transform var(--transicion);
  }
  .opcion:hover {
    background: var(--color-lateral-suave);
    transform: translateX(4px);
  }
  .opcion[aria-current='page'] {
    background: var(--color-lateral-activo);
    color: var(--color-lateral-activo-texto);
  }
  .opcion span {
    display: flex;
    flex-direction: column;
  }
  .opcion small {
    font-size: var(--texto-xs);
    font-weight: 600;
    opacity: 0.8;
  }
  .destacada {
    background: var(--color-lateral-suave);
  }
  .tema {
    margin-top: auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: var(--radio-m);
    background: var(--color-lateral-suave);
  }
  .tema button {
    min-height: 40px;
    border: 0;
    border-radius: 12px;
    font: inherit;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
    background: transparent;
    color: var(--color-lateral-texto);
    cursor: pointer;
  }
  .tema button[aria-pressed='true'] {
    background: var(--color-lateral-activo);
    color: var(--color-lateral-activo-texto);
  }
  .cuenta {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-2);
  }
  .tarjeta {
    display: flex;
    align-items: center;
    gap: var(--espacio-3);
    padding: var(--espacio-3);
    border: 0;
    border-radius: var(--radio-l);
    background: var(--color-lateral-suave);
    color: var(--color-lateral-texto);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform var(--transicion);
  }
  .tarjeta:hover {
    transform: translateY(-2px);
  }
  .tarjeta[aria-current='page'] {
    box-shadow: inset 0 0 0 var(--trazo) var(--color-lateral-texto);
  }
  .inicial {
    width: 46px;
    height: 46px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--color-lateral-activo);
    color: var(--color-lateral-activo-texto);
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-titulo);
    font-size: 20px;
  }
  .quien {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .quien strong {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .quien small {
    font-size: var(--texto-s);
    opacity: 0.8;
  }
  .salir {
    align-self: flex-start;
    border: 0;
    background: none;
    color: var(--color-lateral-texto);
    font: inherit;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
    text-decoration: underline;
    padding: var(--espacio-1) var(--espacio-2);
    cursor: pointer;
  }
</style>

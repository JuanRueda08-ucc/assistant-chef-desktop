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

    <section class="cuenta" aria-labelledby="titulo-cuenta">
      <h2 id="titulo-cuenta">Mi cuenta</h2>
      {#if usuario && !sinCuenta}
        <p class="nombre">{usuario.nombre}</p>
        <p class="correo">{usuario.email}</p>
        <button
          type="button"
          class="opcion"
          aria-current={app.verMiCuenta ? 'page' : undefined}
          onclick={() => app.abrirMiCuenta()}
          ><Icono nombre="personas" /><span>Ver mi cuenta</span></button
        >
        <button
          type="button"
          class="opcion"
          onclick={() => {
            cerrar()
            void app.salir()
          }}><Icono nombre="atras" /><span>Cerrar sesión</span></button
        >
      {:else}
        <p class="correo">
          Modo de desarrollo sin cuenta de Supabase: tu despensa y tus recetas se guardan en este
          equipo.
        </p>
        <button
          type="button"
          class="opcion"
          aria-current={app.verMiCuenta ? 'page' : undefined}
          onclick={() => app.abrirMiCuenta()}
          ><Icono nombre="personas" /><span>Ver mi cuenta</span></button
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
    background: rgba(29, 29, 27, 0.35);
    animation: aparecer 160ms ease-out;
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
    padding: var(--espacio-4);
    background: var(--color-superficie);
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.2);
    animation: entrar 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
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
    padding-bottom: var(--espacio-3);
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-titulo);
    font-size: var(--texto-l);
  }
  .cabeza img {
    width: 40px;
    height: 40px;
    object-fit: contain;
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
    background: var(--color-relleno);
    color: var(--color-tinta);
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
    font-weight: var(--peso-fuerte);
    text-align: left;
    color: var(--color-tinta);
    background: transparent;
    border: 0;
    border-radius: var(--radio-boton);
    cursor: pointer;
    transition: background-color var(--transicion);
  }
  .opcion:hover,
  .opcion[aria-current='page'] {
    background: var(--color-relleno);
  }
  .opcion span {
    display: flex;
    flex-direction: column;
  }
  .opcion small {
    font-size: var(--texto-xs);
    font-weight: 600;
    color: var(--color-tinta-suave);
  }
  .destacada {
    background: var(--color-acento-suave);
  }
  .cuenta {
    margin-top: auto;
    padding-top: var(--espacio-4);
    border-top: var(--borde) solid var(--color-separador);
  }
  .cuenta h2 {
    font-size: var(--texto-m);
    margin-bottom: var(--espacio-2);
  }
  .cuenta p {
    margin: 0 0 var(--espacio-2);
  }
  .nombre {
    font-weight: var(--peso-fuerte);
  }
  .correo {
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
    line-height: 1.4;
  }
</style>

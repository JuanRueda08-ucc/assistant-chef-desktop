<script lang="ts">
  import { REQUISITOS_CONTRASENA } from '@shared/contrasena'
  import { textoReinicio, USO_VISIBLE } from '@shared/ia/uso'
  import { USUARIO_LOCAL, type ResultadoCuenta } from '@shared/types/cuenta'
  import hablando from '../assets/chef/chef_hablando.png'
  import Boton from '../componentes/Boton.svelte'
  import { app } from '../estado/app.svelte'

  // «Mi cuenta» (decisión 0026, opción C «Una columna», elegida por el autor el 2026-11-10): el
  // chef saluda y debajo hay una fila por opción; al pulsarla se despliega su detalle en el sitio.
  type Seccion = 'nombre' | 'uso' | 'contrasena' | 'borrar'
  let abierta = $state<Seccion | null>(null)
  let ocupado = $state(false)
  let error = $state<string | null>(null)
  let aviso = $state<string | null>(null)

  const usuario = $derived(app.cuenta?.usuario ?? null)
  const sinCuenta = $derived(usuario?.id === USUARIO_LOCAL.id)
  let nombre = $state(app.cuenta?.usuario?.nombre ?? '')
  let actual = $state('')
  let nueva = $state('')
  let contrasenaBorrar = $state('')
  let confirmacion = $state('')

  $effect(() => {
    void app.actualizarUso()
  })

  const nChats = $derived(app.chats.length)
  const nRecetas = $derived(app.misRecetas.length)
  const resumen = $derived(
    `${nChats} ${nChats === 1 ? 'chat' : 'chats'} y ${nRecetas} ${nRecetas === 1 ? 'receta guardada' : 'recetas guardadas'} en tu cuenta`
  )

  function alternar(seccion: Seccion): void {
    abierta = abierta === seccion ? null : seccion
    error = null
    aviso = null
    actual = ''
    nueva = ''
    contrasenaBorrar = ''
    confirmacion = ''
    nombre = usuario?.nombre ?? ''
  }

  async function ejecutar(
    accion: () => Promise<ResultadoCuenta>,
    hecho: string | null
  ): Promise<boolean> {
    if (ocupado) return false
    ocupado = true
    error = null
    aviso = null
    try {
      const r = await accion()
      if (!r.ok) {
        error = r.error.mensaje
        return false
      }
      app.cuenta = r.estado
      aviso = hecho
      return true
    } catch {
      error = 'No se pudo completar. Inténtalo de nuevo.'
      return false
    } finally {
      ocupado = false
    }
  }

  async function guardarNombre(evento: SubmitEvent): Promise<void> {
    evento.preventDefault()
    if (await ejecutar(() => window.api.cuenta.cambiarNombre({ nombre }), 'Nombre guardado.'))
      abierta = null
  }

  async function guardarContrasena(evento: SubmitEvent): Promise<void> {
    evento.preventDefault()
    const ok = await ejecutar(
      () => window.api.cuenta.cambiarContrasena({ actual, nueva }),
      'Contraseña cambiada. Úsala la próxima vez que entres.'
    )
    if (ok) {
      actual = ''
      nueva = ''
    }
  }

  async function borrarCuenta(evento: SubmitEvent): Promise<void> {
    evento.preventDefault()
    if (confirmacion !== 'BORRAR') return
    const ok = await ejecutar(
      () => window.api.cuenta.borrar({ contrasena: contrasenaBorrar, confirmacion: 'BORRAR' }),
      null
    )
    if (ok) app.alBorrarCuenta()
  }
</script>

<main class="mi-cuenta">
  <div class="columna">
    <div class="volver">
      <Boton variante="secundario" onclick={() => app.cerrarMiCuenta()}>Volver</Boton>
    </div>

    <header class="hola">
      <img src={hablando} alt="" />
      <h1>Hola, {usuario?.nombre || 'cocinero'}</h1>
      <p>
        {usuario?.email}{#if !sinCuenta}&nbsp;· {resumen}{/if}
      </p>
    </header>

    {#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}

    {#if sinCuenta}
      <p class="nota">
        Estás en modo de desarrollo, sin cuenta de Supabase: cambiar el nombre o la contraseña y
        borrar la cuenta solo funcionan con una cuenta real.
      </p>
    {/if}

    <section class="seccion" class:abierta={abierta === 'nombre'}>
      <button
        type="button"
        class="fila"
        aria-expanded={abierta === 'nombre'}
        onclick={() => alternar('nombre')}
      >
        <span class="t"><strong>Tu nombre</strong><small>{usuario?.nombre}</small></span>
        <span class="accion">{abierta === 'nombre' ? 'Cerrar' : 'Cambiar ›'}</span>
      </button>
      {#if abierta === 'nombre'}
        <form class="detalle" onsubmit={guardarNombre}>
          <label
            >Nombre
            <input bind:value={nombre} maxlength="60" required autocomplete="name" /></label
          >
          {#if error}<p class="error" role="alert">{error}</p>{/if}
          <div>
            <Boton tipo="submit" disabled={ocupado || !nombre.trim()}>Guardar nombre</Boton>
          </div>
        </form>
      {/if}
    </section>

    <section class="seccion" class:abierta={abierta === 'uso'}>
      <button
        type="button"
        class="fila"
        aria-expanded={abierta === 'uso'}
        onclick={() => alternar('uso')}
      >
        <span class="t"
          ><strong>Tu uso de hoy</strong><small
            >{#if app.uso}Chat: quedan {app.uso.grupos.chat.restantes} de {app.uso.grupos.chat
                .limite} · Voz: {app.uso.grupos.voz.restantes} de {app.uso.grupos.voz.limite} · {textoReinicio(
                app.uso.reinicioEn,
                Date.now()
              )}{:else}No se pudo consultar ahora{/if}</small
          ></span
        >
        {#if app.uso}
          {@const uso = app.uso}
          <span class="mini" aria-hidden="true">
            {#each USO_VISIBLE.slice(0, 3) as v (v.grupo)}
              {@const g = uso.grupos[v.grupo]}
              <span><i style:width="{(g.restantes / g.limite) * 100}%"></i></span>
            {/each}
          </span>
        {/if}
        <span class="accion">{abierta === 'uso' ? 'Cerrar' : '›'}</span>
      </button>
      {#if abierta === 'uso' && app.uso}
        {@const uso = app.uso}
        <ul class="detalle uso">
          {#each USO_VISIBLE as v (v.grupo)}
            {@const g = uso.grupos[v.grupo]}
            <li>
              <span class="linea"
                ><span>{v.nombre}</span><span
                  >quedan <strong>{g.restantes}</strong> de {g.limite}</span
                ></span
              >
              <span class="barra" aria-hidden="true"
                ><span style:width="{(g.restantes / g.limite) * 100}%"></span></span
              >
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="seccion" class:abierta={abierta === 'contrasena'}>
      <button
        type="button"
        class="fila"
        aria-expanded={abierta === 'contrasena'}
        onclick={() => alternar('contrasena')}
      >
        <span class="t"><strong>Contraseña</strong><small>Cámbiala cuando quieras</small></span>
        <span class="accion">{abierta === 'contrasena' ? 'Cerrar' : 'Cambiar ›'}</span>
      </button>
      {#if abierta === 'contrasena'}
        <form class="detalle" onsubmit={guardarContrasena}>
          <label
            >Contraseña actual
            <input
              type="password"
              bind:value={actual}
              autocomplete="current-password"
              maxlength="128"
              required
            /></label
          >
          <label
            >Contraseña nueva
            <input
              type="password"
              bind:value={nueva}
              autocomplete="new-password"
              maxlength="128"
              required
            /></label
          >
          <ul class="requisitos" aria-label="La contraseña nueva necesita">
            {#each REQUISITOS_CONTRASENA as r (r.id)}
              {@const cumple = r.cumple(nueva)}
              <li class:cumple>{cumple ? '✓' : '·'} {r.texto}</li>
            {/each}
          </ul>
          {#if error}<p class="error" role="alert">{error}</p>{/if}
          <div>
            <Boton tipo="submit" disabled={ocupado || !actual || !nueva}>Guardar contraseña</Boton>
          </div>
        </form>
      {/if}
    </section>

    <section class="seccion">
      <button type="button" class="fila" onclick={() => void app.salir()}>
        <span class="t"
          ><strong>Cerrar sesión</strong><small>Tus chats y recetas siguen en tu cuenta</small
          ></span
        >
        <span class="accion">›</span>
      </button>
    </section>

    <section class="seccion peligro" class:abierta={abierta === 'borrar'}>
      <button
        type="button"
        class="fila"
        aria-expanded={abierta === 'borrar'}
        onclick={() => alternar('borrar')}
      >
        <span class="t"
          ><strong>Borrar mi cuenta</strong><small
            >Borra la cuenta, los chats y las recetas. No se puede deshacer.</small
          ></span
        >
        <span class="accion">{abierta === 'borrar' ? 'Cerrar' : '›'}</span>
      </button>
      {#if abierta === 'borrar'}
        <form class="detalle" onsubmit={borrarCuenta}>
          <p>
            Se borrarán para siempre tu cuenta, {resumen.replace(' en tu cuenta', '')}, y lo que la
            app guardaba en este equipo (tu despensa y la receta en curso). Después tendrías que
            crear una cuenta nueva.
          </p>
          <label
            >Tu contraseña
            <input
              type="password"
              bind:value={contrasenaBorrar}
              autocomplete="current-password"
              maxlength="128"
              required
            /></label
          >
          <label
            >Escribe BORRAR para confirmar
            <input
              bind:value={confirmacion}
              autocomplete="off"
              spellcheck="false"
              required
            /></label
          >
          {#if error}<p class="error" role="alert">{error}</p>{/if}
          <div>
            <button
              type="submit"
              class="borrar"
              disabled={ocupado || !contrasenaBorrar || confirmacion !== 'BORRAR'}
              >{ocupado ? 'Borrando…' : 'Borrar mi cuenta para siempre'}</button
            >
          </div>
        </form>
      {/if}
    </section>
  </div>
</main>

<style>
  .mi-cuenta {
    overflow-y: auto;
    padding: 0 var(--espacio-4) var(--espacio-6);
  }
  .columna {
    width: min(640px, 100%);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
  }
  .volver {
    align-self: flex-start;
  }
  .hola {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--espacio-2);
    text-align: center;
    padding-bottom: var(--espacio-2);
  }
  .hola img {
    width: 120px;
  }
  .hola h1 {
    font-size: 38px;
    line-height: 1.05;
  }
  .hola p {
    margin: 0;
    color: var(--color-tinta-suave);
  }
  .nota,
  .aviso {
    margin: 0;
    font-size: var(--texto-s);
    padding-left: var(--espacio-3);
    border-left: 4px solid var(--color-acento);
  }
  .aviso {
    font-weight: var(--peso-fuerte);
    color: var(--color-hierba);
    border-left-color: var(--color-hierba);
  }
  .seccion {
    background: var(--color-superficie);
    border-radius: var(--radio-l);
    overflow: hidden;
  }
  .fila {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--espacio-4);
    padding: var(--espacio-4) var(--espacio-5);
    border: 0;
    background: none;
    font: inherit;
    color: var(--color-tinta);
    text-align: left;
    cursor: pointer;
  }
  .fila:focus-visible {
    outline: var(--foco);
    outline-offset: -4px;
  }
  .t {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .t strong {
    font-family: var(--fuente-titulo);
    font-size: 19px;
    font-weight: var(--peso-titulo);
  }
  .t small {
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
  }
  .accion {
    font-family: var(--fuente-titulo);
    font-size: var(--texto-l);
    color: var(--color-tinta-suave);
    white-space: nowrap;
  }
  .mini {
    display: flex;
    gap: 6px;
  }
  .mini span {
    width: 46px;
    height: 8px;
    border-radius: var(--radio-pildora);
    background: var(--color-relleno);
    overflow: hidden;
  }
  .mini i,
  .barra span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--color-acento);
  }
  .detalle {
    margin: 0;
    padding: 0 var(--espacio-5) var(--espacio-5);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
  }
  .detalle p {
    margin: 0;
    line-height: 1.5;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-1);
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
  }
  input {
    font: inherit;
    font-weight: var(--peso-texto);
    font-size: var(--texto-m);
    min-height: 48px;
    padding: 0 var(--espacio-3);
    border-radius: var(--radio-m);
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    color: var(--color-tinta);
  }
  input:focus-visible {
    outline: var(--foco);
    outline-offset: 2px;
  }
  .uso {
    list-style: none;
  }
  .uso li {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-1);
  }
  .linea {
    display: flex;
    justify-content: space-between;
    gap: var(--espacio-3);
  }
  .barra {
    height: 8px;
    border-radius: var(--radio-pildora);
    background: var(--color-relleno);
    overflow: hidden;
  }
  .requisitos {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 2px;
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
  }
  .requisitos li.cumple {
    color: var(--color-hierba);
    font-weight: var(--peso-fuerte);
  }
  .error {
    margin: 0;
    font-size: var(--texto-s);
    font-weight: var(--peso-fuerte);
    padding-left: var(--espacio-3);
    border-left: 4px solid var(--color-tinta);
  }
  .peligro {
    border: 2px dashed var(--color-tomate-borde);
    background: var(--color-tomate-fondo);
  }
  .peligro .t strong,
  .peligro .accion {
    color: var(--color-tomate);
  }
  .borrar {
    font: inherit;
    font-weight: var(--peso-fuerte);
    min-height: var(--alto-control);
    padding: 0 var(--espacio-5);
    border: 0;
    border-radius: var(--radio-boton);
    background: var(--color-tomate);
    color: var(--color-superficie);
    cursor: pointer;
  }
  .borrar:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .borrar:focus-visible {
    outline: var(--foco);
    outline-offset: 2px;
  }
</style>

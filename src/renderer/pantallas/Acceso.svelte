<script lang="ts">
  import { CONTRASENA_MIN, LONGITUD_CODIGO } from '@shared/esquemas/cuenta'
  import type { ResultadoCuenta } from '@shared/types/cuenta'
  import Boton from '../componentes/Boton.svelte'
  import ChefBlob from '../componentes/ChefBlob.svelte'
  import { app } from '../estado/app.svelte'

  // Entrar, crear cuenta, confirmar el correo con un código y recuperar la contraseña
  // (decisión 0016). Una sola tarjeta que cambia de modo; el token lo guarda main.
  type Modo = 'entrar' | 'registrar' | 'verificar' | 'recuperar' | 'restablecer'
  let modo = $state<Modo>('entrar')
  let nombre = $state('')
  let email = $state('')
  let contrasena = $state('')
  let codigo = $state('')
  let ocupado = $state(false)
  let error = $state<string | null>(null)
  let aviso = $state<string | null>(null)

  const TITULOS: Record<Modo, string> = {
    entrar: 'Entra en tu cuenta',
    registrar: 'Crea tu cuenta',
    verificar: 'Confirma tu correo',
    recuperar: 'Recupera tu contraseña',
    restablecer: 'Elige una contraseña nueva'
  }
  const BOTONES: Record<Modo, string> = {
    entrar: 'Entrar',
    registrar: 'Crear cuenta',
    verificar: 'Confirmar',
    recuperar: 'Enviar código',
    restablecer: 'Cambiar contraseña'
  }

  function ir(nuevo: Modo, mensaje: string | null = null): void {
    modo = nuevo
    error = null
    aviso = mensaje
    contrasena = ''
    codigo = ''
  }

  async function ejecutar(accion: () => Promise<ResultadoCuenta>): Promise<ResultadoCuenta | null> {
    if (ocupado) return null
    ocupado = true
    error = null
    try {
      const r = await accion()
      if (!r.ok) error = r.error.mensaje
      return r
    } catch {
      error = 'No se pudo completar. Inténtalo de nuevo.'
      return null
    } finally {
      ocupado = false
    }
  }

  async function enviar(): Promise<void> {
    const datos = { email: email.trim() }
    if (modo === 'entrar') {
      const r = await ejecutar(() => window.api.cuenta.entrar({ ...datos, contrasena }))
      if (r?.ok) await app.alEntrar(r.estado)
      else if (r && !r.ok && r.error.codigo === 'correo_sin_verificar') {
        await window.api.cuenta.reenviar(datos)
        ir('verificar', `Te enviamos un código nuevo a ${datos.email}.`)
      }
    } else if (modo === 'registrar') {
      const r = await ejecutar(() =>
        window.api.cuenta.registrar({ ...datos, nombre: nombre.trim(), contrasena })
      )
      if (r?.ok)
        ir('verificar', `Te enviamos un código de ${LONGITUD_CODIGO} cifras a ${datos.email}.`)
    } else if (modo === 'verificar') {
      const r = await ejecutar(() => window.api.cuenta.verificar({ ...datos, codigo }))
      if (r?.ok) await app.alEntrar(r.estado)
    } else if (modo === 'recuperar') {
      const r = await ejecutar(() => window.api.cuenta.recuperar(datos))
      if (r?.ok)
        ir('restablecer', `Si ${datos.email} tiene cuenta, le llegará un código para cambiarla.`)
    } else {
      const r = await ejecutar(() =>
        window.api.cuenta.restablecer({ ...datos, codigo, contrasena })
      )
      if (r?.ok) ir('entrar', 'Contraseña cambiada. Ya puedes entrar con la nueva.')
    }
  }

  async function reenviar(): Promise<void> {
    const r = await ejecutar(() => window.api.cuenta.reenviar({ email: email.trim() }))
    if (r?.ok) aviso = 'Código reenviado. Mira también en la carpeta de spam.'
  }
</script>

<main class="acceso">
  <section class="tarjeta" aria-labelledby="titulo-acceso">
    <div class="cabeza">
      <ChefBlob pose="busto" tamano={88} />
      <div>
        <p class="antetitulo">Chef digital</p>
        <h1 id="titulo-acceso">{TITULOS[modo]}</h1>
      </div>
    </div>

    {#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}

    <form
      onsubmit={(e) => {
        e.preventDefault()
        void enviar()
      }}
    >
      {#if modo === 'registrar'}
        <label
          >Nombre
          <input bind:value={nombre} autocomplete="name" maxlength="60" required /></label
        >
      {/if}
      {#if modo !== 'verificar' && modo !== 'restablecer'}
        <label
          >Correo
          <input type="email" bind:value={email} autocomplete="email" required /></label
        >
      {/if}
      {#if modo === 'verificar' || modo === 'restablecer'}
        <label
          >Código de {LONGITUD_CODIGO} cifras
          <input
            class="codigo"
            bind:value={codigo}
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength={LONGITUD_CODIGO}
            pattern={`\\d{${LONGITUD_CODIGO}}`}
            required
          /></label
        >
      {/if}
      {#if modo === 'entrar' || modo === 'registrar' || modo === 'restablecer'}
        <label
          >{modo === 'restablecer' ? 'Contraseña nueva' : 'Contraseña'}
          <input
            type="password"
            bind:value={contrasena}
            autocomplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            minlength={modo === 'entrar' ? 1 : CONTRASENA_MIN}
            maxlength="128"
            required
          /></label
        >
        {#if modo !== 'entrar'}
          <p class="nota">Al menos {CONTRASENA_MIN} caracteres.</p>
        {/if}
      {/if}

      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <Boton tipo="submit" ancho disabled={ocupado}>{ocupado ? 'Un momento…' : BOTONES[modo]}</Boton
      >
    </form>

    <nav class="enlaces" aria-label="Otras opciones">
      {#if modo === 'entrar'}
        <button type="button" onclick={() => ir('registrar')}>Crear una cuenta</button>
        <button type="button" onclick={() => ir('recuperar')}>He olvidado mi contraseña</button>
      {:else if modo === 'verificar'}
        <button type="button" disabled={ocupado} onclick={reenviar}>Reenviar código</button>
        <button type="button" onclick={() => ir('entrar')}>Volver a entrar</button>
      {:else}
        <button type="button" onclick={() => ir('entrar')}>Ya tengo cuenta: entrar</button>
      {/if}
    </nav>
    {#if app.cuenta?.sinConexion}
      <p class="nota">Sin conexión con el servidor de cuentas.</p>
    {/if}
  </section>
</main>

<style>
  .acceso {
    display: grid;
    place-items: center;
    padding: var(--espacio-6);
    overflow-y: auto;
  }
  .tarjeta {
    width: min(480px, 100%);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
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
  .nota {
    margin: 0;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }
  h1 {
    font-size: var(--texto-xl);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
  }
  input {
    font: inherit;
    font-weight: var(--peso-texto);
    min-height: 52px;
    padding: 0 var(--espacio-4);
    border-radius: var(--radio-m);
    border: var(--borde) solid var(--color-borde-control);
    background: var(--color-superficie);
    color: var(--color-tinta);
  }
  input:focus-visible {
    outline: var(--foco);
    outline-offset: 2px;
  }
  .codigo {
    font-family: var(--fuente-titulo);
    font-size: var(--texto-l);
    letter-spacing: 0.4em;
    font-variant-numeric: tabular-nums;
  }
  .aviso,
  .error {
    margin: 0;
    font-size: var(--texto-s);
    padding-left: var(--espacio-3);
    border-left: 4px solid var(--color-acento);
  }
  .error {
    border-left-color: var(--color-tinta);
    font-weight: 600;
  }
  .enlaces {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--espacio-2);
  }
  .enlaces button {
    font: inherit;
    font-size: var(--texto-s);
    font-weight: 600;
    background: none;
    border: 0;
    color: var(--color-tinta);
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: var(--espacio-2) 0;
    cursor: pointer;
  }
  .enlaces button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>

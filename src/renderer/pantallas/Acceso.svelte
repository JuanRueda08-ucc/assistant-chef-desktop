<script lang="ts">
  import { REQUISITOS_CONTRASENA } from '@shared/contrasena'
  import { CODIGO_MAX, CODIGO_MIN, CONTRASENA_MIN } from '@shared/esquemas/cuenta'
  import type { ResultadoCuenta } from '@shared/types/cuenta'
  import Boton from '../componentes/Boton.svelte'
  import { cubicOut } from 'svelte/easing'
  import { fly } from 'svelte/transition'
  import celebracion from '../assets/chef/celebracion_leve.png'
  import escuchando from '../assets/chef/chef_escuchando.png'
  import esperando from '../assets/chef/chef_esperando.png'
  import hablando from '../assets/chef/chef_hablando.png'
  import Icono from '../componentes/Icono.svelte'
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
  // Lado amarillo (0027): frase, palabra resaltada, pose del chef y etiquetas para cada modo.
  const ESCENA: Record<Modo, { antes: string; resalta: string; texto: string; imagen: string }> = {
    entrar: {
      antes: 'Hola otra vez,',
      resalta: '¡a cocinar!',
      texto: 'Tus chats, tus recetas y tu despensa te esperan.',
      imagen: hablando
    },
    registrar: {
      antes: 'Tu cocina,',
      resalta: 'a tu medida',
      texto: 'Crea tu cuenta y guarda tus chats y recetas en la nube.',
      imagen: celebracion
    },
    verificar: {
      antes: 'Mira tu',
      resalta: 'correo',
      texto: 'Te enviamos un código de 6 cifras. Puede tardar un minuto.',
      imagen: escuchando
    },
    recuperar: {
      antes: 'Tranquilo,',
      resalta: 'pasa a todos',
      texto: 'Te enviamos un código para elegir una contraseña nueva.',
      imagen: esperando
    },
    restablecer: {
      antes: 'Casi listo:',
      resalta: 'nueva clave',
      texto: 'Escribe el código del correo y tu contraseña nueva.',
      imagen: esperando
    }
  }
  const ETIQUETAS = ['Tomate', 'Huevo', 'Arroz', 'Pollo'] as const
  const escena = $derived(ESCENA[modo])

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
      if (r?.ok) ir('verificar', `Te enviamos un código a ${datos.email}. Mira también en spam.`)
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
  <section class="escena" aria-hidden="true">
    <div class="circulo"></div>
    {#each ETIQUETAS as etiqueta, i (etiqueta)}
      <span class="etiqueta e{i}">{etiqueta}</span>
    {/each}
    {#key modo}
      <div class="frase" in:fly={{ y: 24, duration: 450, easing: cubicOut }}>
        <p class="marca">Chef digital</p>
        <p class="grande">{escena.antes}<br /><span class="resalta">{escena.resalta}</span></p>
        <p class="texto">{escena.texto}</p>
      </div>
      <div class="figura" in:fly={{ y: 40, duration: 550, easing: cubicOut }}>
        <img src={escena.imagen} alt="" />
      </div>
    {/key}
  </section>

  <section class="lado-form">
    <div class="tarjeta" aria-labelledby="titulo-acceso">
      {#if modo === 'entrar' || modo === 'registrar'}
        <div class="pestanas" role="group" aria-label="Entrar o crear cuenta">
          <button type="button" aria-pressed={modo === 'entrar'} onclick={() => ir('entrar')}
            >Entrar</button
          >
          <button type="button" aria-pressed={modo === 'registrar'} onclick={() => ir('registrar')}
            >Crear cuenta</button
          >
          <span class="indicador" class:derecha={modo === 'registrar'} aria-hidden="true"></span>
        </div>
      {/if}

      {#key modo}
        <div class="contenido" in:fly={{ x: 24, duration: 380, easing: cubicOut }}>
          <h1 id="titulo-acceso">{TITULOS[modo]}</h1>

          {#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}

          <form
            onsubmit={(e) => {
              e.preventDefault()
              void enviar()
            }}
          >
            {#if modo === 'registrar'}
              <label class="entra" style="--i: 1"
                >Nombre
                <input bind:value={nombre} autocomplete="name" maxlength="60" required /></label
              >
            {/if}
            {#if modo !== 'verificar' && modo !== 'restablecer'}
              <label class="entra" style="--i: 2"
                >Correo
                <input type="email" bind:value={email} autocomplete="email" required /></label
              >
            {/if}
            {#if modo === 'verificar' || modo === 'restablecer'}
              <label class="entra" style="--i: 2"
                >Código del correo
                <input
                  class="codigo"
                  bind:value={codigo}
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength={CODIGO_MAX}
                  pattern={`\\d{${CODIGO_MIN},${CODIGO_MAX}}`}
                  required
                /></label
              >
            {/if}
            {#if modo === 'entrar' || modo === 'registrar' || modo === 'restablecer'}
              <label class="entra" style="--i: 3"
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
                <!-- Mismos requisitos que el proyecto de Supabase; se marcan mientras se escribe. -->
                <ul class="requisitos" aria-label="La contraseña necesita">
                  {#each REQUISITOS_CONTRASENA as r (r.id)}
                    {@const cumple = r.cumple(contrasena)}
                    <li class:cumple>
                      {#if cumple}<Icono nombre="check" tamano={16} />{:else}<span
                          class="punto"
                          aria-hidden="true"
                        ></span>{/if}
                      <span
                        >{r.texto}<span class="oculto">{cumple ? ': listo' : ': falta'}</span></span
                      >
                    </li>
                  {/each}
                </ul>
              {/if}
            {/if}

            {#if error}<p class="error" role="alert">{error}</p>{/if}
            <div class="entra" style="--i: 4">
              <Boton tipo="submit" ancho disabled={ocupado}
                >{ocupado ? 'Un momento…' : BOTONES[modo]}</Boton
              >
            </div>
          </form>

          <nav class="enlaces" aria-label="Otras opciones">
            {#if modo === 'entrar'}
              <button type="button" onclick={() => ir('recuperar')}
                >He olvidado mi contraseña</button
              >
            {:else if modo === 'verificar'}
              <button type="button" disabled={ocupado} onclick={reenviar}>Reenviar código</button>
              <button type="button" onclick={() => ir('entrar')}>Volver a entrar</button>
            {:else if modo !== 'registrar'}
              <button type="button" onclick={() => ir('entrar')}>Volver a entrar</button>
            {/if}
          </nav>
          {#if app.cuenta?.sinConexion}
            <p class="nota">Sin conexión con el servidor de cuentas.</p>
          {/if}
        </div>
      {/key}
    </div>
  </section>
</main>

<style>
  /* Acceso (0027): mitad amarilla con el chef y una frase por modo; la otra mitad, el formulario. */
  .acceso {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(380px, 1fr);
    gap: var(--espacio-5);
    padding: 0 var(--espacio-6) var(--espacio-6);
    min-height: 0;
    overflow-y: auto;
  }
  .escena {
    position: relative;
    min-height: 560px;
    border-radius: var(--radio-xl);
    background: var(--color-escenario);
    color: var(--color-sobre-acento);
    overflow: hidden;
    animation: aparecer-escala 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .circulo {
    position: absolute;
    width: 460px;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--color-escenario-circulo);
    right: -90px;
    bottom: -110px;
  }
  .frase {
    position: relative;
    z-index: 2;
    padding: clamp(28px, 4vw, 48px);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
    max-width: 36ch;
  }
  .marca {
    margin: 0;
    font-weight: var(--peso-titulo);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: var(--texto-s);
  }
  .grande {
    margin: 0;
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-titulo);
    font-size: clamp(40px, 4.4vw, 60px);
    line-height: 1.08;
    letter-spacing: -0.03em;
  }
  /* Bloque propio con su interlineado, como en la bienvenida: no pisa la línea de arriba. */
  .resalta {
    display: inline-block;
    margin-top: 0.12em;
    padding: 0.04em 0.22em 0.1em;
    line-height: 1;
    border-radius: 0.22em;
    background: var(--color-sobre-acento);
    color: var(--color-escenario);
    transform: rotate(-1.5deg);
    white-space: nowrap;
  }
  .texto {
    margin: 0;
    font-size: var(--texto-m);
    line-height: 1.5;
  }
  .figura {
    position: absolute;
    right: 40px;
    bottom: 10px;
    z-index: 1;
  }
  .figura img {
    display: block;
    width: min(300px, 24vw);
    animation: respirar 3.2s ease-in-out infinite;
  }
  .etiqueta {
    position: absolute;
    z-index: 2;
    padding: 8px 16px;
    border-radius: var(--radio-pildora);
    border: 3px solid var(--color-sobre-acento);
    background: var(--color-pegatina);
    color: var(--color-sobre-acento);
    font-weight: var(--peso-titulo);
    box-shadow: 0 5px 0 var(--color-sobre-acento);
    animation: flotar 3.4s ease-in-out infinite;
  }
  .e0 {
    --giro: -8deg;
    left: 8%;
    bottom: 26%;
  }
  .e1 {
    --giro: 6deg;
    left: 30%;
    bottom: 10%;
    animation-delay: 500ms;
  }
  .e2 {
    --giro: -4deg;
    right: 8%;
    top: 12%;
    animation-delay: 900ms;
  }
  .e3 {
    --giro: 9deg;
    left: 12%;
    bottom: 6%;
    animation-delay: 1300ms;
  }
  .lado-form {
    display: grid;
    place-items: center;
  }
  .tarjeta {
    width: min(460px, 100%);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
    padding: var(--espacio-6);
    background: var(--color-superficie);
    border-radius: var(--radio-xl);
    box-shadow: 0 10px 0 var(--color-acento);
    animation: subir 560ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .contenido {
    display: flex;
    flex-direction: column;
    gap: var(--espacio-4);
  }
  /* Pestañas «Entrar / Crear cuenta» con un indicador amarillo que se desliza. */
  .pestanas {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 4px;
    border-radius: var(--radio-m);
    background: var(--color-relleno);
  }
  .pestanas button {
    position: relative;
    z-index: 1;
    min-height: 44px;
    border: 0;
    background: none;
    font: inherit;
    font-weight: var(--peso-titulo);
    color: var(--color-tinta);
    cursor: pointer;
  }
  .pestanas button[aria-pressed='true'] {
    color: var(--color-sobre-acento);
  }
  .indicador {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc(50% - 4px);
    border-radius: 12px;
    background: var(--color-acento);
    box-shadow: var(--sombra-boton);
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .indicador.derecha {
    transform: translateX(100%);
  }
  @media (max-width: 900px) {
    .acceso {
      grid-template-columns: 1fr;
    }
    .escena {
      min-height: 280px;
    }
  }
  .antetitulo,
  .nota {
    margin: 0;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }
  .requisitos {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--espacio-1);
    font-size: var(--texto-s);
    color: var(--color-tinta-suave);
  }
  .requisitos li {
    display: flex;
    align-items: center;
    gap: var(--espacio-2);
  }
  .requisitos li.cumple {
    color: var(--color-tinta);
    font-weight: 600;
  }
  .requisitos li.cumple :global(svg) {
    color: var(--color-exito);
  }
  .punto {
    width: 16px;
    height: 16px;
    flex: none;
    display: grid;
    place-items: center;
  }
  .punto::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-borde-control);
  }
  .oculto {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  h1 {
    font-size: 34px;
    letter-spacing: -0.02em;
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

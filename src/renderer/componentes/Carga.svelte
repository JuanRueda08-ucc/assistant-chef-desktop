<script lang="ts">
  import { quintInOut } from 'svelte/easing'
  import { fly } from 'svelte/transition'
  import hablando from '../assets/chef/chef_hablando.png'

  // Pantalla de carga al abrir la app (0027): el chef sobre el amarillo mientras se lee la cuenta y
  // el catálogo. Al terminar, toda la pantalla sube y deja ver la app.
</script>

<div
  class="carga"
  role="status"
  aria-label="Preparando tu cocina"
  out:fly={{ y: -window.innerHeight, duration: 750, easing: quintInOut, opacity: 1 }}
>
  <div class="circulo"><img src={hablando} alt="" /></div>
  <p class="marca">Chef digital</p>
  <div class="vapor" aria-hidden="true"><i></i><i></i><i></i></div>
  <p class="texto">Preparando tu cocina…</p>
</div>

<style>
  .carga {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--espacio-4);
    background: var(--color-escenario);
    color: var(--color-sobre-acento);
  }
  .circulo {
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: var(--color-escenario-circulo);
    display: grid;
    place-items: center;
    overflow: hidden;
    animation: aparecer-escala 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .circulo img {
    width: 210px;
    margin-top: 34px;
    animation: respirar 2.4s ease-in-out infinite;
  }
  .marca {
    margin: 0;
    font-family: var(--fuente-titulo);
    font-weight: var(--peso-titulo);
    font-size: 54px;
    letter-spacing: -0.03em;
    animation: subir 600ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .vapor {
    display: flex;
    gap: 10px;
  }
  .vapor i {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-sobre-acento);
    animation: saltar 900ms ease-in-out infinite;
  }
  .vapor i:nth-child(2) {
    animation-delay: 150ms;
  }
  .vapor i:nth-child(3) {
    animation-delay: 300ms;
  }
  .texto {
    margin: 0;
    font-weight: var(--peso-fuerte);
  }
  @keyframes saltar {
    0%,
    100% {
      transform: translateY(0);
      opacity: 0.35;
    }
    50% {
      transform: translateY(-12px);
      opacity: 1;
    }
  }
</style>

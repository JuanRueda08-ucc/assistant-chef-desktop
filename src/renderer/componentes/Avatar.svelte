<script lang="ts" module>
  import abajo from '../assets/chef/chef_abajo.png'
  import arriba from '../assets/chef/chef_arriba.png'
  import celebracionFinal from '../assets/chef/chef_celebracion_final.png'
  import celebracionLeve from '../assets/chef/celebracion_leve.png'
  import derecha from '../assets/chef/chef_derecha.png'
  import escuchando from '../assets/chef/chef_escuchando.png'
  import esperando from '../assets/chef/chef_esperando.png'
  import estatico from '../assets/chef/chef_estatico.png'
  import hablando from '../assets/chef/chef_hablando.png'
  import izquierda from '../assets/chef/chef_izquierda.png'
  import type { Pose } from './avatar'

  const IMAGENES: Record<Pose, string> = {
    estatico,
    hablando,
    escuchando,
    esperando,
    derecha,
    izquierda,
    arriba,
    abajo,
    celebracionLeve,
    celebracionFinal
  }
</script>

<script lang="ts">
  import type { EstadoAvatar } from '@shared/types/sesion'
  import { poseDe } from './avatar'

  // Chef de cuerpo entero sobre su círculo. Recibe solo un EstadoAvatar: hoy muestra imágenes
  // fijas; con Rive, este componente cambiará por dentro (las entradas de la máquina de estados
  // saldrán de `poseDe`) sin que cambie quien lo usa.
  interface Props {
    estado: EstadoAvatar
    escuchando?: boolean
    tamano?: number
  }
  let { estado, escuchando: oyendo = false, tamano = 300 }: Props = $props()
  const pose = $derived(poseDe(estado, oyendo))
</script>

<!-- El margen superior reserva el sitio del gorro, que sobresale del círculo. -->
<div
  class="avatar"
  style:width="{tamano}px"
  style:height="{tamano}px"
  style:margin-top="{Math.round(tamano * 0.22)}px"
  data-pose={pose}
>
  {#each Object.entries(IMAGENES) as [nombre, src] (nombre)}
    <!-- Todas cargadas y apiladas: cambiar de pose no parpadea mientras se descarga la imagen. -->
    <img {src} alt="" class:visible={nombre === pose} />
  {/each}
</div>

<style>
  .avatar {
    position: relative;
    flex: none;
    border-radius: 50%;
    background: var(--color-blob);
  }
  img {
    position: absolute;
    /* El chef sobresale del círculo por arriba y por los lados, como en la maqueta. */
    inset: -22% -14% 0;
    width: 128%;
    height: 122%;
    object-fit: contain;
    object-position: center bottom;
    opacity: 0;
  }
  img.visible {
    opacity: 1;
  }
  @media (prefers-reduced-motion: no-preference) {
    img {
      transition: opacity 120ms ease-out;
    }
  }
</style>

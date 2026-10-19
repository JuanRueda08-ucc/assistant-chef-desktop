<script lang="ts" module>
  import busto from '../assets/chef/chef_busto.png'
  import estatico from '../assets/chef/chef_estatico.png'
  import hablando from '../assets/chef/chef_hablando.png'
  import celebracionLeve from '../assets/chef/celebracion_leve.png'

  // Poses usadas por ahora. El componente Avatar con todos los estados llega en la tarea 13.
  const POSES = { busto, estatico, hablando, celebracionLeve } as const
  export type PoseChef = keyof typeof POSES
</script>

<script lang="ts">
  // El chef sobre su círculo amarillo (docs/diseno.md, "Blob").
  interface Props {
    pose?: PoseChef
    tamano?: number
    /** Texto alternativo; vacío si el chef es decorativo junto a un globo que ya habla. */
    alt?: string
  }
  let { pose = 'busto', tamano = 112, alt = '' }: Props = $props()
</script>

<div class="blob" style:width="{tamano}px" style:height="{tamano}px">
  <img src={POSES[pose]} {alt} />
</div>

<style>
  .blob {
    position: relative;
    flex: none;
    border-radius: 50%;
    background: var(--color-blob);
  }
  img {
    position: absolute;
    /* La imagen es algo mayor que el círculo para que el gorro sobresalga. */
    inset: -6%;
    width: 112%;
    height: 112%;
    object-fit: contain;
  }
</style>

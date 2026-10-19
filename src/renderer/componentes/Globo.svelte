<script lang="ts">
  import type { Snippet } from 'svelte'

  // Globo de diálogo del chef: blanco con el trazo de tinta y una cola hacia el chef.
  interface Props {
    cola?: 'izquierda' | 'abajo'
    children: Snippet
  }
  let { cola = 'izquierda', children }: Props = $props()
</script>

<div class="globo cola-{cola}">
  {@render children()}
</div>

<style>
  .globo {
    position: relative;
    background: var(--color-superficie);
    border: var(--trazo) solid var(--color-tinta);
    border-radius: 22px;
    padding: var(--espacio-4) var(--espacio-5);
    line-height: 1.35;
  }
  .globo::after {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    background: inherit;
    border-left: var(--trazo) solid var(--color-tinta);
    border-bottom: var(--trazo) solid var(--color-tinta);
  }
  .cola-izquierda::after {
    left: -11px;
    top: 28px;
    transform: rotate(45deg);
  }
  .cola-abajo::after {
    left: 54px;
    bottom: -11px;
    transform: rotate(-45deg);
  }
</style>

<script lang="ts">
  import { escalarReceta } from '@shared/recetas/escalado'
  import { indexar, ingredientesSinVerificar } from '@shared/recetas/etiquetas'
  import {
    estadoIngredienteGenerado,
    type EstadoIngredienteGenerado
  } from '@shared/recetas/receta-generada'
  import { NOMBRE_ALERGENO, NOMBRE_DIFICULTAD } from '@shared/textos'
  import type { RecetaGenerada } from '@shared/types/receta'
  import { app } from '../estado/app.svelte'
  import { describirIngrediente } from '../lib/medidas'
  import Icono from './Icono.svelte'

  // Una receta escrita por la IA, en Elegir y en Mis recetas. Lo que tienes, los alérgenos y las
  // cantidades los calcula el código.
  let { generada }: { generada: RecetaGenerada } = $props()

  const ETIQUETA_ESTADO: Record<EstadoIngredienteGenerado, string> = {
    tienes: 'Lo tienes',
    basico: 'Básico',
    falta: 'Falta',
    opcional: 'Opcional'
  }
  const catalogo = $derived([...app.catalogo, ...generada.ingredientesNuevos])
  const receta = $derived(escalarReceta(generada.receta, app.preferencias.porciones).receta)
  const sinVerificar = $derived(ingredientesSinVerificar(receta, catalogo))
  const ingredientes = $derived.by(() => {
    const porId = indexar(catalogo)
    return receta.ingredientes.map((ir) => {
      const ingrediente = porId.get(ir.ingredienteId)
      return {
        id: ir.id,
        estado: estadoIngredienteGenerado(ir, ingrediente, app.preferencias),
        ...describirIngrediente({
          cantidad: ir.cantidad,
          unidad: ir.unidad,
          ingrediente,
          idIngrediente: ir.ingredienteId,
          preparacion: ir.preparacion
        })
      }
    })
  })
</script>

<ul class="datos" aria-label="Datos de la receta">
  <li><Icono nombre="reloj" tamano={18} />{receta.tiempoTotalMin} min</li>
  <li>
    <Icono nombre="personas" tamano={18} />{receta.porcionesBase}
    {receta.porcionesBase === 1 ? 'porción' : 'porciones'}
  </li>
  <li><Icono nombre="nivel" tamano={18} />{NOMBRE_DIFICULTAD[receta.dificultad]}</li>
</ul>

{#if receta.alergenos.length}
  <ul class="etiquetas" aria-label="Alérgenos">
    {#each receta.alergenos as a (a)}
      <li>Contiene {NOMBRE_ALERGENO[a].toLocaleLowerCase('es')}</li>
    {/each}
  </ul>
{/if}

{#if sinVerificar.length > 0}
  <p class="sin-verificar" role="status">
    Alérgenos sin verificar: {sinVerificar.join(', ')}. No puedo confirmar que encaje con tus
    alergias o tu dieta; revisa sus etiquetas{app.preferencias.alergias.length > 0
      ? ', sobre todo por tus alergias'
      : ''}.
  </p>
{/if}

<p class="aviso-ia">
  La escribió una IA y nadie la ha revisado. Vigila los tiempos y el punto de cocción, y cocina bien
  la carne, el pescado y el huevo.
</p>

<section aria-labelledby="titulo-ingredientes-generada">
  <h3 id="titulo-ingredientes-generada">Ingredientes</h3>
  <ul class="ingredientes">
    {#each ingredientes as ing (ing.id)}
      <li>
        <span class="estado" class:falta={ing.estado === 'falta'}
          >{ETIQUETA_ESTADO[ing.estado]}</span
        >
        <span><b>{ing.nombre}</b> <small>{ing.detalle}</small></span>
      </li>
    {/each}
  </ul>
</section>

<section aria-labelledby="titulo-pasos-generada">
  <h3 id="titulo-pasos-generada">Pasos</h3>
  <ol class="pasos">
    {#each receta.pasos as paso (paso.id)}<li>{paso.texto}</li>{/each}
  </ol>
</section>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  h3 {
    margin: 0 0 var(--espacio-2);
    font-family: var(--fuente-titulo);
    font-size: var(--texto-m);
  }
  .datos {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .datos li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px var(--espacio-3);
    border-radius: var(--radio-pildora);
    background: var(--color-acento);
    border: var(--borde) solid var(--color-tinta);
    font-weight: var(--peso-fuerte);
    font-size: var(--texto-s);
  }
  .etiquetas {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espacio-2);
  }
  .etiquetas li {
    padding: 6px 12px;
    border: var(--borde) dashed var(--color-tinta);
    border-radius: var(--radio-pildora);
    font-size: var(--texto-xs);
    font-weight: 600;
  }
  .sin-verificar {
    margin: 0;
    padding: var(--espacio-3) var(--espacio-4);
    border: var(--borde) dashed var(--color-tinta);
    border-radius: var(--radio-m);
    background: var(--color-acento-suave);
    font-size: var(--texto-s);
    font-weight: 600;
  }
  .aviso-ia {
    margin: 0;
    padding-left: var(--espacio-3);
    border-left: 4px solid var(--color-acento);
    font-size: var(--texto-s);
  }
  .ingredientes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--espacio-2) var(--espacio-4);
  }
  .ingredientes li {
    display: flex;
    align-items: flex-start;
    gap: var(--espacio-3);
    padding: var(--espacio-2) 0;
    border-bottom: var(--borde) solid var(--color-separador);
  }
  .ingredientes small {
    display: block;
    color: var(--color-tinta-suave);
    font-size: var(--texto-s);
  }
  .estado {
    flex: none;
    min-width: 76px;
    padding: 3px 8px;
    border: var(--borde) solid var(--color-borde-control);
    border-radius: var(--radio-pildora);
    font-size: var(--texto-xs);
    font-weight: var(--peso-fuerte);
    text-align: center;
  }
  .estado.falta {
    background: var(--color-tinta);
    border-color: var(--color-tinta);
    color: var(--color-superficie);
  }
  .pasos {
    margin: 0;
    padding-left: var(--espacio-5);
    line-height: 1.45;
  }
  .pasos li {
    padding: var(--espacio-1) 0;
  }
</style>

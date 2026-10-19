import { mount } from 'svelte'

// Tipografías incluidas en la app (sin red): ver docs/diseno.md.
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/figtree/wght.css'
import './styles/tokens.css'

import App from './App.svelte'

const destino = document.getElementById('app')
if (!destino) throw new Error('No existe el elemento #app')

const app = mount(App, { target: destino })

export default app

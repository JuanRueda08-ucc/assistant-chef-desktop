import { mount } from 'svelte'

import './styles/tokens.css'

import App from './App.svelte'

const destino = document.getElementById('app')
if (!destino) throw new Error('No existe el elemento #app')

const app = mount(App, { target: destino })

export default app

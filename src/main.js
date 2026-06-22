import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'

import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'

import App from './App.vue'
import './css/editor.scss'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(Quasar, {
  plugins: {}
})

app.mount('#app')

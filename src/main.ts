import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router' // <--- Importar router

createApp(App)
  .use(router) // <--- Usar router
  .mount('#app')
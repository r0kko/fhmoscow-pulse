import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import './brand.css'
import { refreshFromCookie } from './auth.js'
import { initCsrf } from './api.js'

initCsrf()
  .catch(() => {})
  .finally(() => {
    refreshFromCookie().finally(() => {
      createApp(App).use(router).mount('#app')
    })
  })

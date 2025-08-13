import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import 'bootstrap/dist/css/bootstrap.min.css';
import './brand.css';
import './mobile.css';
import { refreshFromCookie } from './auth.js';
import { initCsrf } from './api.js';
import edgeFade from './utils/edgeFade.js';

initCsrf()
  .catch(() => {})
  .finally(() => {
    refreshFromCookie().finally(() => {
      const app = createApp(App);
      app.use(router);
      app.directive('edge-fade', edgeFade);
      app.mount('#app');
    });
  });

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './brand.css';
import './mobile.css';
import { refreshFromCookie } from './auth';
import { initCsrf } from './api';
import edgeFade from './utils/edgeFade';

const PUBLIC_BOOT_PATHS = ['/verify', '/login', '/register', '/password-reset'];
const VERIFY_BOOT_PATHS = ['/verify'];

function isPublicBootPath(pathname: string) {
  return PUBLIC_BOOT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isVerifyBootPath(pathname: string) {
  return VERIFY_BOOT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function mountApp() {
  const app = createApp(App);
  app.use(router);
  app.directive('edge-fade', edgeFade);
  void router.isReady().finally(() => {
    app.mount('#app');
  });
}

const pathname =
  typeof window !== 'undefined' ? window.location.pathname || '/' : '/';
const publicPath = isPublicBootPath(pathname);
const verifyPath = isVerifyBootPath(pathname);

if (verifyPath) {
  mountApp();
} else if (publicPath) {
  mountApp();
  void initCsrf().catch(() => {});
  void refreshFromCookie().catch(() => {});
} else {
  initCsrf()
    .catch(() => {})
    .finally(() => {
      refreshFromCookie()
        .catch(() => {})
        .finally(() => {
          mountApp();
        });
    });
}

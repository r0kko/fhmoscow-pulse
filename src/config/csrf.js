import lusca from 'lusca';

import { isSecureEnv, cookieSameSite, cookieDomain } from './security.js';

// Use a dedicated cookie name to avoid collisions with legacy/app cookies
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'XSRF-TOKEN-API';

const csrfOptions = {
  // Explicitly configure Angular-style header without forcing default cookie name
  header: 'X-XSRF-TOKEN',
  cookie: {
    name: CSRF_COOKIE_NAME,
    options: {
      sameSite: cookieSameSite(),
      secure: isSecureEnv(),
      domain: cookieDomain(),
      path: '/',
    },
  },
};

export default lusca.csrf(csrfOptions);

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
      // Opt-in to partitioned cookies to improve cross-site delivery in modern browsers
      // (effective only when Secure and SameSite=None)
      partitioned:
        isSecureEnv() &&
        String(process.env.COOKIE_PARTITIONED || 'true').toLowerCase() ===
          'true',
    },
  },
};

export default lusca.csrf(csrfOptions);

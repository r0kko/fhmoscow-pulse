import lusca from 'lusca';

import { isSecureEnv, cookieSameSite, cookieDomain } from './security.js';

const csrfOptions = {
  angular: true,
  cookie: {
    options: {
      sameSite: cookieSameSite(),
      secure: isSecureEnv(),
      domain: cookieDomain(),
    },
  },
};

export default lusca.csrf(csrfOptions);

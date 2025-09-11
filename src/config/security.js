// Centralized security helpers to avoid relying solely on NODE_ENV

export function isSecureEnv() {
  const force = String(process.env.FORCE_SECURE_COOKIES || '').toLowerCase();
  if (force === '1' || force === 'true' || force === 'yes') return true;
  if (process.env.NODE_ENV === 'production') return true;
  try {
    const base = process.env.BASE_URL || '';
    if (base.startsWith('https://')) return true;
  } catch (_e) {
    /* noop */
  }
  return false;
}

export function cookieSameSite() {
  return isSecureEnv() ? 'none' : 'lax';
}

export function cookieDomain() {
  return process.env.COOKIE_DOMAIN || undefined;
}

// Separate override for CSRF cookie domain. Best practice is to keep CSRF
// cookies host-only to avoid cross-site collisions; set only if you know you
// need a wider domain.
export function csrfCookieDomain() {
  return process.env.CSRF_COOKIE_DOMAIN || undefined;
}

export default { isSecureEnv, cookieSameSite, cookieDomain, csrfCookieDomain };

// Centralized feature flags with safe defaults geared towards UX.
// In production, lockout/rate limiting are enabled by default.
// In non-production environments, defaults stay relaxed for local UX.

function toBool(val, defaultVal = false) {
  if (val == null) return defaultVal;
  const s = String(val).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export function isLockoutEnabled() {
  const isProd =
    String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  return toBool(process.env.AUTH_LOCKOUT_ENABLED, isProd);
}

export function isRateLimitEnabled(kind = 'global') {
  const isProd =
    String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const globalDefault = toBool(process.env.RATE_LIMIT_ENABLED, isProd);
  const envName = `RATE_LIMIT_${String(kind).toUpperCase()}_ENABLED`;
  if (Object.prototype.hasOwnProperty.call(process.env, envName)) {
    return toBool(process.env[envName], globalDefault);
  }
  return globalDefault;
}

export default { isLockoutEnabled, isRateLimitEnabled };

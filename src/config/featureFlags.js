// Centralized feature flags with safe defaults geared towards UX.
// By default, API-side rate limiting and account lockout are disabled,
// assuming protection at the edge (CDN/WAF) and audit via metrics.

function toBool(val, defaultVal = false) {
  if (val == null) return defaultVal;
  const s = String(val).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export function isLockoutEnabled() {
  // Disable by default to improve UX; rely on edge protections and monitoring
  return toBool(process.env.AUTH_LOCKOUT_ENABLED, false);
}

export function isRateLimitEnabled(kind = 'global') {
  // Global default (applies to all kinds unless overridden)
  const globalDefault = toBool(process.env.RATE_LIMIT_ENABLED, false);
  const envName = `RATE_LIMIT_${String(kind).toUpperCase()}_ENABLED`;
  if (Object.prototype.hasOwnProperty.call(process.env, envName)) {
    return toBool(process.env[envName], globalDefault);
  }
  return globalDefault;
}

export default { isLockoutEnabled, isRateLimitEnabled };

import { COOKIE_NAME, COOKIE_OPTIONS } from '../config/auth.js';

function parseHost(header) {
  if (!header) return null;
  const h = String(header).split(',')[0].trim();
  // strip port
  return h.replace(/:\d+$/, '').toLowerCase();
}

function domainMatchesHost(domain, host) {
  if (!domain || !host) return false;
  const d = String(domain).toLowerCase();
  const h = String(host).toLowerCase();
  return h === d || h.endsWith(`.${d}`);
}

function buildCookieOptions(res) {
  const {
    path,
    domain,
    httpOnly,
    sameSite,
    secure,
    maxAge,
    partitioned,
    priority,
  } = COOKIE_OPTIONS;

  const opts = { path, httpOnly, sameSite, secure };

  if (Number.isFinite(maxAge)) opts.maxAge = maxAge;
  if (partitioned) opts.partitioned = true;
  if (priority) opts.priority = priority;

  // Prefer safe, host-only cookies by default. Only apply configured domain if
  // it actually matches the effective request host to avoid browsers rejecting
  // the cookie (common cause of forced re‑login after refresh).
  try {
    const req = res?.req;
    const xfHost = parseHost(req?.headers?.['x-forwarded-host']);
    const host = xfHost || parseHost(req?.headers?.host) || req?.hostname;
    if (domain) {
      if (!host || domainMatchesHost(domain, host)) {
        // If we cannot determine host (tests) or it matches, include domain
        opts.domain = domain;
      }
      // else: ignore mismatched domain; fall back to host-only
    }
  } catch (_e) {
    // On any error, keep default behavior and include configured domain if present
    if (domain) opts.domain = domain;
  }

  return opts;
}

/**
 * Set refresh-token cookie.
 *
 * @param {import('express').Response} res
 * @param {string} token
 */
export function setRefreshCookie(res, token) {
  const options = buildCookieOptions(res);
  res.cookie(COOKIE_NAME, token, options);
}

/**
 * Clear refresh-token cookie.
 *
 * @param {import('express').Response} res
 */
export function clearRefreshCookie(res) {
  const options = buildCookieOptions(res);
  // ensure we don't set maxAge when clearing
  delete options.maxAge;
  // Try multiple variants to cover historical path/domain attributes
  const variants = [];
  const base = { ...options };
  const baseNoDomain = { ...base };
  delete baseNoDomain.domain;
  const baseNoPartition = { ...base };
  delete baseNoPartition.partitioned;
  const baseNoDomainNoPartition = { ...baseNoDomain };
  delete baseNoDomainNoPartition.partitioned;
  // Variant for exact current host as cookie domain
  let hostDomain;
  try {
    const req = res?.req;
    const xf = req?.headers?.['x-forwarded-host'];
    const raw = (Array.isArray(xf) ? xf[0] : xf) || req?.headers?.host || '';
    hostDomain = String(raw).split(',')[0].trim().replace(/:\d+$/, '');
  } catch (_) {
    hostDomain = undefined;
  }

  // Path variants
  const paths = ['/', '/api'];
  for (const p of paths) {
    variants.push({ ...base, path: p });
    variants.push({ ...baseNoDomain, path: p });
    variants.push({ ...baseNoPartition, path: p });
    variants.push({ ...baseNoDomainNoPartition, path: p });
    if (hostDomain) variants.push({ ...base, path: p, domain: hostDomain });
  }
  // Issue clear for all variants
  for (const v of variants) {
    res.clearCookie(COOKIE_NAME, v);
  }
}

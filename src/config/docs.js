import net from 'node:net';

/*
 * API documentation (Swagger UI) exposure policy.
 * The goal is to keep the UI reachable for local developers while preventing
 * direct access from the public Internet in production.
 *
 * Modes:
 *   - disabled — always return 404 for /api-docs requests.
 *   - local    — allow loopback and private network clients only (default).
 *   - public   — a permissive mode for ad-hoc troubleshooting.
 *
 * Additional allow-list entries can be supplied via API_DOCS_ALLOWLIST as a
 * comma-separated list of IPs or IPv4 CIDR blocks (e.g., "127.0.0.1,10.0.0.0/24").
 * Loopback addresses are always accepted to avoid locking out local tooling.
 */

const rawMode = String(
  process.env.API_DOCS_ACCESS ||
    process.env.API_DOCS_MODE ||
    process.env.API_DOCS_VISIBILITY ||
    ''
)
  .trim()
  .toLowerCase();

const defaultMode = 'local';
const mode = rawMode || defaultMode;

const allowList = parseAllowList(
  process.env.API_DOCS_ALLOWLIST || process.env.API_DOCS_ALLOW || ''
);

function isDocsEnabled() {
  return mode !== 'disabled';
}

function isDocsPublic() {
  return mode === 'public';
}

function isApiDocsRequestAllowed(req) {
  if (!isDocsEnabled()) return false;
  if (isDocsPublic()) return true;

  const candidates = collectCandidateIps(req);
  if (candidates.length === 0) return false;

  // Loopback is always allowed to keep local Swagger tooling working.
  if (candidates.some(isLoopbackAddress)) return true;

  if (allowList.length > 0) {
    return candidates.some((ip) =>
      allowList.some((entry) => matchesAllowEntry(ip, entry))
    );
  }

  // Fall back to private network checks when no explicit allow list is set.
  return candidates.some((ip) => isPrivateAddress(ip));
}

function collectCandidateIps(req) {
  const set = new Set();
  if (req?.ip) set.add(req.ip);
  if (Array.isArray(req?.ips)) req.ips.forEach((ip) => set.add(ip));
  const headers = req?.headers || {};
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (typeof forwarded === 'string') {
    forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((ip) => set.add(ip));
  }
  const remote =
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    req?.info?.remoteAddress;
  if (remote) set.add(remote);

  return Array.from(set).map(normalizeIp).filter(Boolean);
}

function normalizeIp(value) {
  if (!value) return '';
  let ip = value.trim();
  if (!ip) return '';

  // Remove IPv6 zone id, e.g. fe80::1%lo0
  const zoneIndex = ip.indexOf('%');
  if (zoneIndex !== -1) {
    ip = ip.slice(0, zoneIndex);
  }

  // Strip IPv6 literals wrapped in [] (common in proxy headers)
  if (ip.startsWith('[') && ip.includes(']')) {
    ip = ip.slice(1, ip.indexOf(']'));
  }

  // Handle IPv4-mapped IPv6 addresses ::ffff:127.0.0.1
  if (/^::ffff:/i.test(ip)) {
    ip = ip.slice(ip.lastIndexOf(':') + 1);
  }

  // Remove :port for IPv4 values like 127.0.0.1:443
  if (net.isIP(ip) === 0 && ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length === 2 && /^[0-9]+$/.test(parts[1])) {
      const maybeIp = parts[0];
      if (net.isIP(maybeIp) > 0) ip = maybeIp;
    }
  }

  if (net.isIP(ip) === 0) return '';
  return ip.includes(':') ? ip.toLowerCase() : ip;
}

function isLoopbackAddress(ip) {
  if (!ip) return false;
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  if (net.isIPv4(ip)) return ip.startsWith('127.');
  return false;
}

function isPrivateAddress(ip) {
  if (!ip) return false;
  if (net.isIPv4(ip)) {
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('169.254.')) return true;
    if (ip.startsWith('172.')) {
      const parts = ip.split('.');
      const second = Number(parts[1]);
      return Number.isInteger(second) && second >= 16 && second <= 31;
    }
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (lower.startsWith('fe80')) return true; // link-local
  }
  return false;
}

function parseAllowList(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map(parseAllowEntry)
    .filter(Boolean);
}

function parseAllowEntry(entry) {
  if (!entry) return null;
  const normalized = entry.toLowerCase();
  if (normalized === 'loopback' || normalized === 'localhost') {
    return { type: 'loopback' };
  }
  if (entry.includes('/')) {
    const [base, prefixRaw] = entry.split('/', 2);
    const prefix = Number(prefixRaw);
    if (!Number.isInteger(prefix)) return null;
    const baseIp = normalizeIp(base);
    if (!baseIp) return null;
    if (net.isIPv4(baseIp) && prefix >= 0 && prefix <= 32) {
      return { type: 'cidrv4', base: baseIp, prefix };
    }
    if (net.isIPv6(baseIp) && prefix >= 0 && prefix <= 128) {
      return { type: 'cidrv6', base: baseIp, prefix };
    }
    return null;
  }
  const ip = normalizeIp(entry);
  if (ip && net.isIP(ip) > 0) {
    return { type: 'ip', value: ip };
  }
  return null;
}

function matchesAllowEntry(ip, entry) {
  if (!ip || !entry) return false;
  if (entry.type === 'loopback') return isLoopbackAddress(ip);
  if (entry.type === 'ip') return ip === entry.value;
  if (entry.type === 'cidrv4') {
    if (!net.isIPv4(ip)) return false;
    return isIpv4InCidr(ip, entry.base, entry.prefix);
  }
  if (entry.type === 'cidrv6') {
    if (!net.isIPv6(ip)) return false;
    return isIpv6InCidr(ip, entry.base, entry.prefix);
  }
  return false;
}

function isIpv4InCidr(ip, base, prefix) {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function ipv4ToInt(ip) {
  return ip
    .split('.')
    .map((part) => Number(part))
    .reduce((acc, part) => ((acc << 8) + (part & 0xff)) >>> 0, 0);
}

function isIpv6InCidr(ip, base, prefix) {
  if (prefix === 0) return true;
  const ipBytes = ipv6ToBytes(ip);
  const baseBytes = ipv6ToBytes(base);
  if (!ipBytes || !baseBytes) return false;
  const fullBytes = Math.floor(prefix / 8);
  const remainingBits = prefix % 8;

  for (let i = 0; i < fullBytes; i += 1) {
    if (ipBytes[i] !== baseBytes[i]) return false;
  }
  if (remainingBits === 0) return true;

  const mask = 0xff << (8 - remainingBits);
  return (ipBytes[fullBytes] & mask) === (baseBytes[fullBytes] & mask);
}

function ipv6ToBytes(ip) {
  try {
    const segments = expandIpv6(ip).split(':');
    const bytes = [];
    for (const segment of segments) {
      const value = parseInt(segment, 16);
      bytes.push((value >> 8) & 0xff, value & 0xff);
    }
    return bytes;
  } catch (_err) {
    return null;
  }
}

function expandIpv6(ip) {
  if (!net.isIPv6(ip)) throw new Error('Invalid IPv6');
  const [main] = ip.split('%');
  const zoneLess = main || ''; // main may be empty when ip === ''
  const parts = zoneLess.split('::');
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts[1] ? parts[1].split(':') : [];
  const missing = 8 - (head.length + tail.length);
  const zeros = Array.from({ length: Math.max(missing, 0) }, () => '0000');
  const full = [...head, ...zeros, ...tail].map((segment) =>
    segment.padStart(4, '0')
  );
  return full.join(':');
}

export {
  collectCandidateIps,
  isApiDocsRequestAllowed,
  isDocsEnabled,
  isDocsPublic,
  mode as apiDocsMode,
  allowList as apiDocsAllowList,
};

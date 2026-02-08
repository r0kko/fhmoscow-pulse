import net from 'node:net';

function readHeader(req, headerName) {
  try {
    const value = req?.headers?.[headerName];
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
  } catch {
    return '';
  }
}

function normalizeIp(raw) {
  const input = String(raw || '')
    .split(',')[0]
    .trim();
  if (!input) return '';

  // [IPv6]:port -> IPv6
  if (input.startsWith('[')) {
    const end = input.indexOf(']');
    if (end > 1) {
      const candidate = input.slice(1, end);
      return net.isIP(candidate) ? candidate : '';
    }
  }

  // IPv4:port -> IPv4
  const colonPos = input.lastIndexOf(':');
  const dotPos = input.lastIndexOf('.');
  if (colonPos > -1 && dotPos > -1 && dotPos < colonPos) {
    const candidate = input.slice(0, colonPos);
    return net.isIP(candidate) ? candidate : '';
  }

  return net.isIP(input) ? input : '';
}

function reqIp(req) {
  return normalizeIp(req?.ip || req?.connection?.remoteAddress || '');
}

function headerIp(req, name) {
  return normalizeIp(readHeader(req, name));
}

export function getClientIp(req) {
  const envSource = process.env.RATE_LIMIT_IP_SOURCE;
  const isProd =
    String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const defaultSource = isProd ? 'auto' : 'req_ip';
  const source = String(envSource || defaultSource)
    .trim()
    .toLowerCase();

  if (source === 'cf_connecting_ip') return headerIp(req, 'cf-connecting-ip');
  if (source === 'true_client_ip') return headerIp(req, 'true-client-ip');
  if (source === 'x_real_ip') return headerIp(req, 'x-real-ip');
  if (source === 'x_forwarded_for') return headerIp(req, 'x-forwarded-for');

  if (source === 'auto') {
    return (
      headerIp(req, 'cf-connecting-ip') ||
      headerIp(req, 'true-client-ip') ||
      headerIp(req, 'x-real-ip') ||
      headerIp(req, 'x-forwarded-for') ||
      reqIp(req)
    );
  }

  return reqIp(req);
}

export default { getClientIp };

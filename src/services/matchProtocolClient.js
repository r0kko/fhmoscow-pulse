import fetch from 'node-fetch';

import logger from '../../logger.js';
import ServiceError from '../errors/ServiceError.js';
import { MATCH_PROTOCOL_CONFIG } from '../config/matchProtocol.js';

function maskApiKeyPrefix(key) {
  const text = String(key || '').trim();
  if (!text) return null;
  const [prefix] = text.split('.');
  return prefix ? `${prefix}***` : '***';
}

function parseHttpDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseFilename(contentDisposition) {
  const header = String(contentDisposition || '').trim();
  if (!header) return null;
  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const quoted = header.match(/filename\s*=\s*"([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const plain = header.match(/filename\s*=\s*([^;]+)/i);
  if (plain?.[1]) return plain[1].trim();
  return null;
}

function ensureConfigured() {
  if (!MATCH_PROTOCOL_CONFIG.apiBase || !MATCH_PROTOCOL_CONFIG.apiKey) {
    throw new ServiceError('match_protocol_not_configured', 502);
  }
}

export async function fetchMatchProtocolPdf(
  externalMatchId,
  { etag = null, lastModified = null, requestId = null } = {}
) {
  ensureConfigured();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    MATCH_PROTOCOL_CONFIG.timeoutMs
  );
  const url =
    `${MATCH_PROTOCOL_CONFIG.apiBase}` +
    `/api/integrations/v1/matches/${encodeURIComponent(externalMatchId)}/protocol.pdf`;
  const headers = {
    'X-API-Key': MATCH_PROTOCOL_CONFIG.apiKey,
  };
  if (etag) headers['If-None-Match'] = String(etag);
  if (lastModified) {
    const value =
      lastModified instanceof Date
        ? lastModified.toUTCString()
        : String(lastModified);
    if (value) headers['If-Modified-Since'] = value;
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    logger.warn('Match protocol upstream request failed', {
      request_id: requestId || null,
      external_match_id: externalMatchId,
      api_key_prefix: maskApiKeyPrefix(MATCH_PROTOCOL_CONFIG.apiKey),
      error: err?.name || 'fetch_failed',
    });
    throw new ServiceError('match_protocol_upstream_unavailable', 502);
  }
  clearTimeout(timer);

  const baseMeta = {
    request_id: requestId || null,
    external_match_id: externalMatchId,
    upstream_status: response.status,
    api_key_prefix: maskApiKeyPrefix(MATCH_PROTOCOL_CONFIG.apiKey),
  };

  if (response.status === 304) {
    logger.info('Match protocol upstream cache hit', baseMeta);
    return {
      status: 'not_modified',
      etag: response.headers.get('etag') || etag || null,
      lastModified:
        parseHttpDate(response.headers.get('last-modified')) ||
        parseHttpDate(lastModified),
    };
  }

  if (response.status === 200) {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    logger.info('Match protocol upstream downloaded', baseMeta);
    return {
      status: 'ok',
      buffer,
      etag: response.headers.get('etag') || null,
      lastModified: parseHttpDate(response.headers.get('last-modified')),
      filename: parseFilename(response.headers.get('content-disposition')),
      cacheControl: response.headers.get('cache-control') || null,
    };
  }

  logger.warn('Match protocol upstream returned error', baseMeta);

  if (response.status === 409) {
    throw new ServiceError('match_protocol_requires_finished', 409);
  }
  if (response.status === 422 || response.status === 404) {
    throw new ServiceError('match_protocol_not_available', 422);
  }
  if (response.status === 429) {
    const retryAfter = Number.parseInt(
      String(response.headers.get('retry-after') || ''),
      10
    );
    const err = new ServiceError('match_protocol_rate_limited', 429);
    if (Number.isFinite(retryAfter) && retryAfter > 0) err.retryAfter = retryAfter;
    throw err;
  }
  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('match_protocol_upstream_access_denied', 502);
  }
  throw new ServiceError('match_protocol_upstream_unavailable', 502);
}

export default { fetchMatchProtocolPdf };

import { DADATA_TOKEN, DADATA_TIMEOUT } from '../config/dadata.js';
import logger from '../../logger.js';

const API_BASE = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs';

async function request(endpoint, body) {
  if (!DADATA_TOKEN) {
    logger.warn('DaData token not configured');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DADATA_TIMEOUT);
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${DADATA_TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logger.warn('DaData request failed with status %s', res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    logger.warn('DaData request error: %s', err.message);
    return null;
  }
}

export async function suggestFio(query) {
  if (!query) return [];
  const data = await request('/suggest/fio', { query });
  return data?.suggestions || [];
}

export async function cleanFio(fio) {
  if (!fio) return null;
  const data = await request('/clean/name', [fio]);
  return Array.isArray(data) ? data[0] : null;
}

export default { suggestFio, cleanFio };

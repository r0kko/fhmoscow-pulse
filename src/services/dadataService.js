import {
  DADATA_TOKEN,
  DADATA_TIMEOUT,
  DADATA_SECRET,
} from '../config/dadata.js';
import logger from '../../logger.js';

const API_BASE = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs';
const CLEANER_BASE = 'https://cleaner.dadata.ru/api/v1';

async function request(endpoint, body, useSecret = false, base = API_BASE) {
  if (!DADATA_TOKEN) {
    logger.warn('DaData token not configured');
    return null;
  }
  if (useSecret && !DADATA_SECRET) {
    logger.warn('DaData secret not configured');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DADATA_TIMEOUT);
  try {
    const res = await fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${DADATA_TOKEN}`,
        ...(useSecret && DADATA_SECRET ? { 'X-Secret': DADATA_SECRET } : {}),
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

export async function suggestFio(query, parts) {
  if (!query) return [];
  const body = { query };
  if (Array.isArray(parts) && parts.length) {
    body.parts = parts;
  }
  const data = await request('/suggest/fio', body);
  return data?.suggestions || [];
}

export async function cleanFio(fio) {
  if (!fio) return null;
  const data = await request('/clean/name', [fio]);
  return Array.isArray(data) ? data[0] : null;
}

export async function suggestFmsUnit(query, filters) {
  if (!query) return [];
  const body = { query };
  if (Array.isArray(filters) && filters.length) {
    body.filters = filters;
  }
  const data = await request('/suggest/fms_unit', body);
  return data?.suggestions || [];
}

export async function cleanPassport(passport) {
  if (!passport) return null;
  const data = await request('/clean/passport', [passport], true, CLEANER_BASE);
  return Array.isArray(data) ? data[0] : null;
}

export async function findBankByBic(bic) {
  if (!bic) return null;
  const data = await request('/findById/bank', { query: bic });
  if (!data?.suggestions?.length) return null;
  return data.suggestions[0];
}

export async function findPartyByInn(inn) {
  if (!inn) return null;
  const data = await request('/findById/party', {
    query: inn,
    type: 'INDIVIDUAL',
  });
  if (!data?.suggestions?.length) return null;
  return data.suggestions[0];
}

export default {
  suggestFio,
  cleanFio,
  suggestFmsUnit,
  cleanPassport,
  findBankByBic,
  findPartyByInn,
};

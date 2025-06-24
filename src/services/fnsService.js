import { FNS_TIMEOUT } from '../config/fns.js';
import logger from '../../logger.js';

const STATUS_URL = 'https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status';

async function checkSelfEmployedWithStatus(inn, date = new Date()) {
  if (!inn) return { data: null, status: 400 };
  const body = {
    inn,
    requestDate: date.toISOString().substring(0, 10),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FNS_TIMEOUT);
  try {
    const res = await fetch(STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logger.warn('FNS request failed with status %s', res.status);
      return { data: null, status: res.status };
    }
    return { data: await res.json(), status: res.status };
  } catch (err) {
    clearTimeout(timer);
    logger.warn('FNS request error: %s', err.message);
    return { data: null, status: 0 };
  }
}

export async function checkSelfEmployed(inn, date = new Date()) {
  const { data } = await checkSelfEmployedWithStatus(inn, date);
  return data;
}

export default { checkSelfEmployed, checkSelfEmployedWithStatus };

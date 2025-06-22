import { apiFetch } from './api.js';

export async function suggestFio(query, parts) {
  if (!query) return [];
  try {
    const body = { query };
    if (Array.isArray(parts) && parts.length) body.parts = parts;
    const { suggestions } = await apiFetch('/dadata/suggest-fio', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return suggestions;
  } catch (_err) {
    return [];
  }
}

export async function cleanFio(fio) {
  if (!fio) return null;
  try {
    const { result } = await apiFetch('/dadata/clean-fio', {
      method: 'POST',
      body: JSON.stringify({ fio }),
    });
    return result;
  } catch (_err) {
    return null;
  }
}

import { apiFetch } from './api.js';

export async function suggestFio(query) {
  if (!query) return [];
  try {
    const { suggestions } = await apiFetch('/dadata/suggest-fio', {
      method: 'POST',
      body: JSON.stringify({ query }),
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

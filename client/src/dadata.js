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

export async function suggestFmsUnit(query, filters) {
  if (!query) return [];
  try {
    const body = { query };
    if (Array.isArray(filters) && filters.length) body.filters = filters;
    const { suggestions } = await apiFetch('/dadata/suggest-fms-unit', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return suggestions;
  } catch (_err) {
    return [];
  }
}

export async function cleanPassport(passport) {
  if (!passport) return null;
  try {
    const { result } = await apiFetch('/dadata/clean-passport', {
      method: 'POST',
      body: JSON.stringify({ passport }),
    });
    return result;
  } catch (_err) {
    return null;
  }
}

export async function suggestAddress(query) {
  if (!query) return [];
  try {
    const { suggestions } = await apiFetch('/dadata/suggest-address', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    return suggestions;
  } catch (_err) {
    return [];
  }
}

export async function cleanAddress(address) {
  if (!address) return null;
  try {
    const { result } = await apiFetch('/dadata/clean-address', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
    return result;
  } catch (_err) {
    return null;
  }
}

export async function findBankByBic(bic) {
  if (!bic) return null;
  try {
    const { bank } = await apiFetch('/dadata/find-bank', {
      method: 'POST',
      body: JSON.stringify({ bic }),
    });
    return bank;
  } catch (_err) {
    return null;
  }
}

export async function findOrganizationByInn(inn) {
  if (!inn) return null;
  try {
    const { organization } = await apiFetch('/dadata/find-organization', {
      method: 'POST',
      body: JSON.stringify({ inn }),
    });
    return organization;
  } catch (_err) {
    return null;
  }
}

export async function cleanVehicle(vehicle) {
  if (!vehicle) return null;
  try {
    const { result } = await apiFetch('/dadata/clean-vehicle', {
      method: 'POST',
      body: JSON.stringify({ vehicle }),
    });
    return result;
  } catch (_err) {
    return null;
  }
}

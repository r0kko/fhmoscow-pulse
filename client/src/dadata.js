export async function suggestFio(query) {
  const token = import.meta.env.VITE_DADATA_TOKEN;
  if (!token || !query) return [];
  const res = await fetch(
    'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/fio',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return data.suggestions || [];
}

export async function cleanFio(fio) {
  const token = import.meta.env.VITE_DADATA_TOKEN;
  if (!token || !fio) return null;
  const res = await fetch(
    'https://suggestions.dadata.ru/suggestions/api/4_1/rs/clean/name',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify([fio]),
    }
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? data[0] : null;
}

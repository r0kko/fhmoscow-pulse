export function formatFio(full, mode = 'full') {
  const name = String(full || '').trim();
  if (mode !== 'initials') return name;
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return name;
  const sur = parts[0] || '';
  const ini = parts
    .slice(1)
    .map((p) => (p ? `${p[0].toUpperCase()}.` : ''))
    // UX: no spaces between initials (e.g., "И.П.")
    .join('')
    .trim();
  return `${sur}${ini ? ' ' + ini : ''}`.trim();
}

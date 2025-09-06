export function extractFirstUrl(value) {
  if (!value) return null;
  const s = String(value);
  const m = s.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

export default { extractFirstUrl };

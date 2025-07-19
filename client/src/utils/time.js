export function formatMinutesSeconds(total) {
  if (total == null || isNaN(total)) return '';
  const minutes = Math.floor(total / 60);
  const seconds = Math.round(total % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function parseMinutesSeconds(str) {
  if (!str) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(str);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  return minutes * 60 + seconds;
}

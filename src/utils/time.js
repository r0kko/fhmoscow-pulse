export function formatMinutesSeconds(total) {
  if (total == null || isNaN(total)) return '';
  const minutes = Math.floor(total / 60);
  const seconds = Math.round(total % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

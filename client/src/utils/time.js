export function formatMinutesSeconds(total) {
  if (total == null || isNaN(total)) return '';
  const minutes = Math.floor(total / 60);
  const seconds = Math.round(total % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function parseMinutesSeconds(str) {
  if (!str) return null;
  let minutes;
  let seconds;
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(str);
  if (match) {
    minutes = parseInt(match[1], 10);
    seconds = parseInt(match[2], 10);
  } else if (/^\d{3,4}$/.test(str)) {
    minutes = parseInt(str.slice(0, str.length - 2), 10);
    seconds = parseInt(str.slice(-2), 10);
  } else {
    return null;
  }
  if (
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return minutes * 60 + seconds;
}

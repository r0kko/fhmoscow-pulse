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

const MOSCOW_TZ = 'Europe/Moscow';
const MOSCOW_OFFSET = '+03:00';

export function toDayKey(iso, timeZone = MOSCOW_TZ) {
  if (!iso) return null;
  const date = new Date(iso);
  const [year, month, day] = date
    .toLocaleDateString('en-CA', { timeZone })
    .split('-')
    .map((v) => parseInt(v, 10));
  return Date.UTC(year, month - 1, day);
}

export function toDateTimeLocal(iso, timeZone = MOSCOW_TZ) {
  if (!iso) return '';
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromDateTimeLocal(value, offset = MOSCOW_OFFSET) {
  if (!value) return '';
  return new Date(`${value}:00${offset}`).toISOString();
}

// Helpers to unify kickoff formatting in MSK
function formatParts(date, opts) {
  try {
    return new Intl.DateTimeFormat('ru-RU', opts)
      .formatToParts(date)
      .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  } catch {
    return {};
  }
}

export function isMskMidnight(iso, timeZone = MOSCOW_TZ) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(+d)) return false;
  const parts = formatParts(d, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return parts.hour === '00' && parts.minute === '00';
}

export function formatMskTimeShort(iso, { placeholder = '—:—' } = {}) {
  if (!iso) return placeholder;
  const d = new Date(iso);
  if (Number.isNaN(+d)) return placeholder;
  const parts = formatParts(d, {
    timeZone: MOSCOW_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (parts.hour === '00' && parts.minute === '00') return placeholder;
  return `${parts.hour}:${parts.minute}`;
}

export function formatMskDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  // Weekday, DD month (no year to keep UI compact)
  const text = d.toLocaleDateString('ru-RU', {
    timeZone: MOSCOW_TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

export function formatKickoff(iso) {
  return {
    time: formatMskTimeShort(iso),
    date: formatMskDateLong(iso),
  };
}

export { MOSCOW_TZ };

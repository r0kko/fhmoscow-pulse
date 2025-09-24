export function formatMinutesSeconds(totalSeconds: unknown): string {
  if (totalSeconds === null || totalSeconds === undefined) return '';
  const value = Number(totalSeconds);
  if (!Number.isFinite(value)) return '';
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function parseMinutesSeconds(
  str: string | null | undefined
): number | null {
  if (!str) return null;
  let minutes: number;
  let seconds: number;
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(str);
  if (match) {
    const [, minutesStr = '', secondsStr = ''] = match;
    minutes = Number.parseInt(minutesStr, 10);
    seconds = Number.parseInt(secondsStr, 10);
  } else if (/^\d{3,4}$/.test(str)) {
    minutes = Number.parseInt(str.slice(0, str.length - 2), 10);
    seconds = Number.parseInt(str.slice(-2), 10);
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

export const MOSCOW_TZ = 'Europe/Moscow' as const;
export const MOSCOW_OFFSET = '+03:00' as const;

export function toDayKey(
  iso: string | null,
  timeZone: string = MOSCOW_TZ
): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = date.toLocaleDateString('en-CA', { timeZone }).split('-');
  if (parts.length !== 3) return null;
  const [yearStr = '', monthStr = '', dayStr = ''] = parts;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if ([year, month, day].some((value) => Number.isNaN(value))) return null;
  return Date.UTC(year, month - 1, day);
}

export function toDateTimeLocal(
  iso: string | null,
  timeZone: string = MOSCOW_TZ
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
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
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
  const { year, month, day, hour, minute } = parts;
  if (!year || !month || !day || !hour || !minute) return '';
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function fromDateTimeLocal(
  value: string | null,
  offset: string = MOSCOW_OFFSET
): string {
  if (!value) return '';
  const date = new Date(`${value}:00${offset}`);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toISOString();
  } catch {
    return '';
  }
}

function formatParts(
  date: Date,
  options: Intl.DateTimeFormatOptions
): Record<string, string> {
  try {
    return new Intl.DateTimeFormat('ru-RU', options)
      .formatToParts(date)
      .reduce<Record<string, string>>((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {});
  } catch {
    return {};
  }
}

export function isMskMidnight(
  iso: string | null,
  timeZone: string = MOSCOW_TZ
): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const parts = formatParts(date, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return parts['hour'] === '00' && parts['minute'] === '00';
}

interface TimeFormatOptions {
  placeholder?: string;
}

export function formatMskTimeShort(
  iso: string | null,
  { placeholder = '—:—' }: TimeFormatOptions = {}
): string {
  if (!iso) return placeholder;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return placeholder;
  const parts = formatParts(date, {
    timeZone: MOSCOW_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (parts['hour'] === '00' && parts['minute'] === '00') return placeholder;
  const hour = parts['hour'] ?? '00';
  const minute = parts['minute'] ?? '00';
  return `${hour}:${minute}`;
}

export function formatMskDateLong(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const text = date.toLocaleDateString('ru-RU', {
    timeZone: MOSCOW_TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

export function formatKickoff(iso: string | null): {
  time: string;
  date: string;
} {
  return {
    time: formatMskTimeShort(iso),
    date: formatMskDateLong(iso),
  };
}

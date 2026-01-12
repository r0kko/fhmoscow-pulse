import { utcToMoscow } from './time.js';

const SEASON_START_MONTH = 5; // June (0-based)
const SEASON_START_DAY = 1;

export function seasonAliasFromDate(value) {
  const msk = utcToMoscow(value) || new Date(value);
  if (!msk || Number.isNaN(msk.getTime())) return null;
  const year = msk.getUTCFullYear();
  const month = msk.getUTCMonth();
  const day = msk.getUTCDate();
  const beforeSeasonStart =
    month < SEASON_START_MONTH ||
    (month === SEASON_START_MONTH && day < SEASON_START_DAY);
  return String(beforeSeasonStart ? year - 1 : year);
}

export const SEASON_START = {
  month: SEASON_START_MONTH,
  day: SEASON_START_DAY,
};

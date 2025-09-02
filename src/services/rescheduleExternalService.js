import {
  isExternalDbAvailable,
  updateExternalGameDateAndClearCancelStatus,
} from '../config/externalMariaDb.js';
import { Match } from '../models/index.js';
import logger from '../../logger.js';

// Reschedule postponed game: set new date_start and clear cancel_status in external DB.
// dateStartUtc is a Date (UTC) representing MSK midnight desired.
export async function rescheduleExternalGameDate({ matchId, dateStartUtc }) {
  if (!isExternalDbAvailable()) {
    const err = new Error('External DB unavailable');
    err.code = 'EXTERNAL_DB_UNAVAILABLE';
    throw err;
  }
  const match = await Match.findByPk(matchId, { attributes: ['external_id'] });
  const extGameId = match?.external_id;
  if (!extGameId) {
    const err = new Error('External mapping missing');
    err.code = 'EXTERNAL_MAPPING_MISSING';
    throw err;
  }

  const result = await updateExternalGameDateAndClearCancelStatus({
    gameId: Number(extGameId),
    dateStart: dateStartUtc,
  });
  logger.info(
    'External reschedule applied: game %s -> date_start=%s, cancel_status=NULL (affected=%s)',
    extGameId,
    dateStartUtc.toISOString(),
    result?.affected
  );
  return { ok: true };
}

export default { rescheduleExternalGameDate };

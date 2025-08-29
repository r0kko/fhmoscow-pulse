import logger from '../../logger.js';
import {
  isExternalDbAvailable,
  updateExternalGameDateAndStadium,
} from '../config/externalMariaDb.js';
import { Game as ExtGame } from '../externalModels/index.js';
import { Ground, Match } from '../models/index.js';
import { utcToMoscow } from '../utils/time.js';

// Idempotently sync approved match time and stadium to the external DB.
// Returns { ok: true } when the external row is updated or already in sync.
// Throws on any failure (including unavailable external DB or missing mappings).
export async function syncApprovedMatchToExternal({
  matchId,
  groundId,
  dateStart,
}) {
  if (!isExternalDbAvailable()) {
    const err = new Error('External DB unavailable');
    err.code = 'EXTERNAL_DB_UNAVAILABLE';
    throw err;
  }

  const [match, ground] = await Promise.all([
    Match.findByPk(matchId, { attributes: ['external_id'] }),
    Ground.findByPk(groundId, { attributes: ['external_id'] }),
  ]);
  const extGameId = match?.external_id;
  const extStadiumId = ground?.external_id;
  if (!extGameId || !extStadiumId) {
    const err = new Error('External mapping missing');
    err.code = 'EXTERNAL_MAPPING_MISSING';
    throw err;
  }

  // Fetch current values to keep update idempotent.
  const current = await ExtGame.findByPk(extGameId, {
    attributes: ['id', 'date_start', 'stadium_id'],
  });
  if (!current) {
    const err = new Error('External game not found');
    err.code = 'EXTERNAL_GAME_NOT_FOUND';
    throw err;
  }

  // Internal dateStart is stored in UTC. External system stores Moscow time (UTC+3).
  // Convert UTC -> MSK for external write and comparison.
  const targetUtc = dateStart instanceof Date ? dateStart : new Date(dateStart);
  if (Number.isNaN(targetUtc.getTime())) {
    const err = new Error('Invalid dateStart');
    err.code = 'INVALID_DATE';
    throw err;
  }
  const targetMsk = utcToMoscow(targetUtc);

  const currentDate = current.date_start ? new Date(current.date_start) : null;
  const sameDate =
    currentDate &&
    !Number.isNaN(currentDate.getTime()) &&
    !Number.isNaN(targetMsk.getTime()) &&
    currentDate.getTime() === targetMsk.getTime();
  const sameStadium = Number(current.stadium_id) === Number(extStadiumId);
  if (sameDate && sameStadium) return { ok: true };

  const result = await updateExternalGameDateAndStadium({
    gameId: Number(extGameId),
    dateStart: targetMsk,
    stadiumId: Number(extStadiumId),
  });
  logger.info(
    'External sync applied: game %s -> date_start=%s, stadium_id=%s (affected=%s)',
    extGameId,
    targetMsk.toISOString(),
    extStadiumId,
    result?.affected
  );
  return { ok: true };
}

export default { syncApprovedMatchToExternal };

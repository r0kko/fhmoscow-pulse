import ServiceError from '../errors/ServiceError.js';
import sequelize from '../config/database.js';
import { utcToMoscow } from '../utils/time.js';
import { Match, Team, User, GameStatus } from '../models/index.js';
import { rescheduleExternalGameDate } from '../services/rescheduleExternalService.js';

async function ensureParticipant(userId, match) {
  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  const teamIds = new Set((user.Teams || []).map((t) => t.id));
  const isHome = match?.team1_id && teamIds.has(match.team1_id);
  const isAway = match?.team2_id && teamIds.has(match.team2_id);
  if (!match?.team1_id && !match?.team2_id)
    throw new ServiceError('match_teams_not_set', 409);
  if (!isHome && !isAway)
    throw new ServiceError('forbidden_not_match_member', 403);
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  // Expect YYYY-MM-DD (MSK date selected in UI)
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Compute the UTC timestamp that corresponds to MSK midnight of the selected date.
  // We construct UTC midnight then subtract MSK offset (handled by moscowToUtc on a MSK date).
  // Simpler: build a Date that represents MSK midnight via UTC fields minus offset.
  const mskMidnightUtc = new Date(Date.UTC(y, mo - 1, d) - 3 * 60 * 60 * 1000);
  return mskMidnightUtc;
}

export async function reschedulePostponedMatch({ matchId, date, actorId }) {
  const match = await Match.findByPk(matchId, { include: [GameStatus] });
  if (!match) throw new ServiceError('match_not_found', 404);

  // Only postponed matches can be rescheduled via this flow
  const alias = (match.GameStatus?.alias || '').toUpperCase();
  if (alias !== 'POSTPONED') throw new ServiceError('match_not_postponed', 409);

  await ensureParticipant(actorId, match);

  const dateOnlyUtc = parseDateOnly(date);
  if (!dateOnlyUtc) throw new ServiceError('invalid_date', 400);

  // Must be today or future (MSK)
  const nowMsk = utcToMoscow(new Date()) || new Date();
  const todayKey = Date.UTC(
    nowMsk.getUTCFullYear(),
    nowMsk.getUTCMonth(),
    nowMsk.getUTCDate()
  );
  if (dateOnlyUtc.getTime() < todayKey)
    throw new ServiceError('date_in_past', 400);

  // External write first: set date_start (MSK midnight) and clear cancel_status
  // External DB expects MSK date/time; we send UTC equivalent and convert to MSK string inside the writer.
  await rescheduleExternalGameDate({ matchId, dateStartUtc: dateOnlyUtc });

  // Local transaction: set date_start, scheduled_date, status SCHEDULED
  await sequelize.transaction(async (tx) => {
    const scheduled = await GameStatus.findOne({
      where: { alias: 'SCHEDULED' },
      transaction: tx,
    });
    await match.update(
      {
        date_start: dateOnlyUtc,
        scheduled_date: `${date}`,
        game_status_id: scheduled?.id || match.game_status_id || null,
      },
      { transaction: tx }
    );
  });

  return { ok: true };
}

export default { reschedulePostponedMatch };

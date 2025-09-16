import { Op } from 'sequelize';

import { reconcileForMatch } from '../services/gamePenaltySyncService.js';
import {
  GamePenalty,
  GameViolation,
  Match,
  PenaltyMinutes,
  Player,
  Season,
  Team,
  TeamPlayer,
  Tournament,
  TournamentType,
} from '../models/index.js';
import playerMapper from '../mappers/playerMapper.js';
import {
  GameEvent as ExtGameEvent,
  PenaltyMinutes as ExtPenaltyMinutes,
} from '../externalModels/index.js';

export async function reconcile(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const { ok, reason, upserts, softDeleted } = await reconcileForMatch(
      req.params.id,
      actorId
    );
    if (!ok)
      return res.status(400).json({ error: reason || 'reconcile_failed' });
    return res.json({ ok: true, upserts, softDeleted });
  } catch (e) {
    next(e);
  }
}

export default { reconcile };

export async function list(req, res, next) {
  try {
    const matchId = req.params.id;
    // Prefetch match teams to compute sides
    const match = await Match.findByPk(matchId, {
      attributes: ['id', 'team1_id', 'team2_id', 'tournament_id', 'season_id'],
      include: [
        {
          model: Tournament,
          attributes: ['id', 'type_id'],
          include: [{ model: TournamentType, attributes: ['double_protocol'] }],
        },
        { model: Season, attributes: ['id', 'active'] },
      ],
    });
    if (!match) return res.status(404).json({ error: 'match_not_found' });

    // Build a quick map player_id -> team_id from both teams' rosters
    const roster = await TeamPlayer.findAll({
      where: { team_id: [match.team1_id, match.team2_id].filter(Boolean) },
      attributes: ['team_id', 'player_id'],
      paranoid: false,
    });
    const playerTeam = new Map(
      roster
        .map((tp) => [tp.player_id, tp.team_id])
        .filter(([pid, tid]) => pid && tid)
    );
    const rows = await GamePenalty.findAll({
      where: { game_id: matchId },
      include: [
        {
          model: Player,
          attributes: ['id', 'external_id', 'surname', 'name', 'patronymic'],
        },
        {
          model: GameViolation,
          attributes: ['id', 'external_id', 'name', 'full_name'],
        },
        { model: PenaltyMinutes, attributes: ['id', 'external_id', 'name'] },
      ],
      // We'll sort in JS by computed period, minute, second for accuracy
    });

    const formatClock = (m, s) =>
      `${String(m ?? 0).padStart(2, '0')}:${String(s ?? 0).padStart(2, '0')}`;

    // Visibility for penalties is the same for admins and school staff; route-level
    // authorization already restricts access to ADMIN and SPORT_SCHOOL_STAFF.

    const isDouble = !!match.Tournament?.TournamentType?.double_protocol;
    const isCurrentSeason = !!match.Season?.active;
    if (isDouble && !isCurrentSeason) {
      return res
        .status(403)
        .json({ error: 'penalties_disabled_out_of_season' });
    }
    const perLenSec = (isDouble ? 18 : 20) * 60;
    const visible = rows.map((r) => {
      const teamId = r.penalty_player_id
        ? playerTeam.get(r.penalty_player_id) || null
        : null;
      const side = teamId
        ? String(teamId) === String(match.team1_id)
          ? 'home'
          : String(teamId) === String(match.team2_id)
            ? 'away'
            : null
        : null;
      const minutesName = r.PenaltyMinutes?.name || '';
      const minutesValue = (() => {
        const m = (minutesName || '').match(/\d+/);
        return m ? Number(m[0]) : null;
      })();
      const totalSec = (r.minute ?? 0) * 60 + (r.second ?? 0);
      const computedPeriod = 1 + Math.floor(totalSec / Math.max(1, perLenSec));
      return {
        id: r.id,
        external_id: r.external_id,
        period: r.period, // legacy (not used by UI)
        computed_period: computedPeriod,
        minute: r.minute,
        second: r.second,
        clock: formatClock(r.minute, r.second),
        team_penalty: !!r.team_penalty,
        team_id: teamId,
        side,
        player: playerMapper.toPublic(r.Player) || null,
        violation: r.GameViolation
          ? {
              id: r.GameViolation.id,
              external_id: r.GameViolation.external_id,
              name: r.GameViolation.name,
              full_name: r.GameViolation.full_name,
            }
          : null,
        minutes: r.PenaltyMinutes
          ? {
              id: r.PenaltyMinutes.id,
              external_id: r.PenaltyMinutes.external_id,
              name: r.PenaltyMinutes.name,
            }
          : null,
        minutes_value: minutesValue,
      };
    });

    // Lazy backfill for missing minutes: fetch from external and upsert local mapping + attach to response
    try {
      const missing = visible.filter(
        (x) => x.minutes_value == null && x.external_id
      );
      const extIds = Array.from(
        new Set(missing.map((x) => Number(x.external_id)))
      ).filter((x) => !Number.isNaN(x));
      if (extIds.length) {
        const extEvents = await ExtGameEvent.findAll({
          where: { id: { [Op.in]: extIds } },
          attributes: ['id', 'penalty_minutes_id'],
          raw: true,
        });
        const byId = new Map(extEvents.map((e) => [Number(e.id), e]));
        const minutesExt = Array.from(
          new Set(
            extEvents
              .map((e) => Number(e.penalty_minutes_id))
              .filter((x) => !Number.isNaN(x))
          )
        );
        if (minutesExt.length) {
          // Ensure local dictionary entries exist
          const localMinutes = await PenaltyMinutes.findAll({
            attributes: ['id', 'external_id', 'name'],
            where: { external_id: { [Op.in]: minutesExt } },
            paranoid: false,
            raw: true,
          });
          const known = new Set(localMinutes.map((m) => Number(m.external_id)));
          const missingM = minutesExt.filter((id) => !known.has(id));
          if (missingM.length) {
            const extDict = await ExtPenaltyMinutes.findAll({
              where: { id: { [Op.in]: missingM } },
              attributes: ['id', 'name'],
              raw: true,
            });
            await PenaltyMinutes.sequelize.transaction(async (t) => {
              for (const r of extDict) {
                await PenaltyMinutes.create(
                  { external_id: Number(r.id), name: r.name || null },
                  { transaction: t }
                );
              }
            });
          }
          // Refresh local minutes map
          const allLoc = await PenaltyMinutes.findAll({
            attributes: ['id', 'external_id', 'name'],
            where: { external_id: { [Op.in]: minutesExt } },
            raw: true,
          });
          const locByExt = new Map(
            allLoc.map((m) => [Number(m.external_id), m])
          );
          // Update local GamePenalty rows missing minutes link
          await GamePenalty.sequelize.transaction(async (t) => {
            for (const it of missing) {
              const evt = byId.get(Number(it.external_id));
              const extMin = evt && Number(evt.penalty_minutes_id);
              const loc = extMin ? locByExt.get(extMin) : null;
              if (!loc) continue;
              // Update DB row if not linked
              await GamePenalty.update(
                { penalty_minutes_id: loc.id },
                {
                  where: { external_id: Number(it.external_id) },
                  transaction: t,
                }
              );
              // Attach to response item
              it.minutes = { id: loc.id, external_id: extMin, name: loc.name };
              const m = String(loc.name || '').match(/\d+/);
              it.minutes_value = m ? Number(m[0]) : null;
            }
          });
        }
      }
    } catch (_e) {
      // non-fatal: we keep response without minutes if external is unavailable
    }

    // Backfill sides for team penalties without mapped player using external team_id
    try {
      const needSide = visible.filter(
        (x) => (!x.side || x.side == null) && x.team_penalty && x.external_id
      );
      if (needSide.length && (match.team1_id || match.team2_id)) {
        const teamRows = await Team.findAll({
          where: { id: [match.team1_id, match.team2_id].filter(Boolean) },
          attributes: ['id', 'external_id'],
          raw: true,
        });
        const homeExt = teamRows.find(
          (t) => String(t.id) === String(match.team1_id)
        )?.external_id;
        const awayExt = teamRows.find(
          (t) => String(t.id) === String(match.team2_id)
        )?.external_id;
        const extIds = Array.from(
          new Set(needSide.map((x) => Number(x.external_id)))
        ).filter((x) => !Number.isNaN(x));
        if (extIds.length && (homeExt || awayExt)) {
          const extEvents = await ExtGameEvent.findAll({
            where: { id: { [Op.in]: extIds } },
            attributes: ['id', 'team_id'],
            raw: true,
          });
          const byId = new Map(extEvents.map((e) => [Number(e.id), e]));
          for (const it of needSide) {
            const evt = byId.get(Number(it.external_id));
            const extTeam = evt && Number(evt.team_id);
            if (extTeam != null) {
              if (homeExt != null && Number(homeExt) === extTeam)
                it.side = 'home';
              else if (awayExt != null && Number(awayExt) === extTeam)
                it.side = 'away';
            }
          }
        }
      }
    } catch (_e) {
      /* ignore team penalty side backfill errors */
    }

    // Sort by computed period, then by time
    visible.sort((a, b) => {
      if ((a.computed_period || 0) !== (b.computed_period || 0))
        return (a.computed_period || 0) - (b.computed_period || 0);
      if ((a.minute || 0) !== (b.minute || 0))
        return (a.minute || 0) - (b.minute || 0);
      if ((a.second || 0) !== (b.second || 0))
        return (a.second || 0) - (b.second || 0);
      return String(a.id).localeCompare(String(b.id));
    });

    return res.json({ items: visible });
  } catch (e) {
    next(e);
  }
}

export { list as listPenalties };

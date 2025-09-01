import cron from 'node-cron';
import { Op } from 'sequelize';

import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import {
  Match,
  MatchAgreement,
  MatchAgreementStatus,
  MatchAgreementType,
  Team,
  Ground,
  Tournament,
  TournamentGroup,
  Tour,
} from '../models/index.js';
import emailService from '../services/emailService.js';
import { listTeamUsers } from '../services/teamService.js';
import { utcToMoscow } from '../utils/time.js';

function daysLeftMsk(dateUtc) {
  const now = utcToMoscow(new Date()) || new Date();
  const then = utcToMoscow(dateUtc) || new Date(dateUtc);
  const diff = then.getTime() - now.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function shouldRemind(days) {
  // Daily reminders when < 7 days left (0..6),
  // plus early pings at 14 and 7 days to start coordination sooner.
  if (days < 0) return false; // already started/past
  if (days < 7) return true; // daily window
  return days === 7 || days === 14;
}

export async function runMatchAgreementReminders() {
  await withRedisLock(
    buildJobLockKey('matchAgreementReminders'),
    30 * 60_000,
    async () =>
      withJobMetrics('matchAgreementReminders', async () => {
        try {
          const horizonDays = Math.max(
            1,
            parseInt(process.env.MATCH_REMINDER_HORIZON_DAYS || '14', 10)
          );
          const now = new Date();
          const horizon = new Date(
            now.getTime() + horizonDays * 24 * 60 * 60 * 1000
          );

          const matches = await Match.findAll({
            where: { date_start: { [Op.gt]: now, [Op.lte]: horizon } },
            attributes: [
              'id',
              'date_start',
              'ground_id',
              'team1_id',
              'team2_id',
              'tournament_id',
              'tournament_group_id',
              'tour_id',
            ],
            include: [
              { model: Team, as: 'HomeTeam', attributes: ['name'] },
              { model: Team, as: 'AwayTeam', attributes: ['name'] },
              { model: Ground, attributes: ['name'] },
              { model: Tournament, attributes: ['name'] },
              { model: TournamentGroup, attributes: ['name'] },
              { model: Tour, attributes: ['name'] },
            ],
            order: [['date_start', 'ASC']],
          });
          if (!matches.length) return;

          const ids = matches.map((m) => m.id);

          const [pendingStatus, acceptedStatus] = await Promise.all([
            MatchAgreementStatus.findOne({ where: { alias: 'PENDING' } }),
            MatchAgreementStatus.findOne({ where: { alias: 'ACCEPTED' } }),
          ]);
          const typeById = new Map();
          const types = await MatchAgreementType.findAll({
            attributes: ['id', 'alias'],
          });
          for (const t of types) typeById.set(t.id, t.alias);

          const [pendings, accepted] = await Promise.all([
            pendingStatus
              ? MatchAgreement.findAll({
                  where: {
                    match_id: { [Op.in]: ids },
                    status_id: pendingStatus.id,
                  },
                  attributes: [
                    'id',
                    'match_id',
                    'type_id',
                    'ground_id',
                    'date_start',
                  ],
                })
              : [],
            acceptedStatus
              ? MatchAgreement.findAll({
                  where: {
                    match_id: { [Op.in]: ids },
                    status_id: acceptedStatus.id,
                  },
                  attributes: ['match_id'],
                })
              : [],
          ]);

          const acceptedSet = new Set(accepted.map((a) => a.match_id));
          const pendingByMatch = new Map();
          for (const p of pendings) {
            if (!pendingByMatch.has(p.match_id))
              pendingByMatch.set(p.match_id, p);
          }

          // Preload ground names for pending agreements to improve email clarity
          const pendingGroundIds = Array.from(
            new Set(pendings.map((p) => p.ground_id).filter(Boolean))
          );
          const groundById = new Map();
          if (pendingGroundIds.length) {
            const grounds = await Ground.findAll({
              where: { id: { [Op.in]: pendingGroundIds } },
              attributes: ['id', 'name'],
            });
            for (const g of grounds) groundById.set(g.id, g.name);
          }

          // Cache team users within one run to reduce duplicate lookups
          const usersCache = new Map();
          async function getUsers(teamId) {
            if (!teamId) return [];
            if (usersCache.has(teamId)) return usersCache.get(teamId);
            try {
              const list = (await listTeamUsers(teamId)) || [];
              const withEmail = list.filter((u) => u.email);
              usersCache.set(teamId, withEmail);
              return withEmail;
            } catch {
              usersCache.set(teamId, []);
              return [];
            }
          }

          for (const m of matches) {
            if (acceptedSet.has(m.id)) continue; // already agreed
            const d = daysLeftMsk(m.date_start);
            if (!shouldRemind(d)) continue;

            const pending = pendingByMatch.get(m.id) || null;
            let status = 'no_proposal';
            let recipients = [];
            if (pending) {
              const typeAlias = typeById.get(pending.type_id);
              if (typeAlias === 'HOME_PROPOSAL') {
                status = 'pending_you'; // away should act
                recipients = await getUsers(m.team2_id);
              } else if (typeAlias === 'AWAY_COUNTER') {
                status = 'pending_you'; // home should act
                recipients = await getUsers(m.team1_id);
              } else {
                // unknown type — skip
                continue;
              }
            } else {
              // No pending — ask home side to propose
              recipients = await getUsers(m.team1_id);
            }

            const ctx = {
              matchId: m.id,
              team1: m.HomeTeam?.name || 'Команда 1',
              team2: m.AwayTeam?.name || 'Команда 2',
              tournament: m.Tournament?.name || '',
              group: m.TournamentGroup?.name || '',
              tour: m.Tour?.name || '',
              ground: pending
                ? groundById.get(pending.ground_id) || ''
                : m.Ground?.name || '',
              kickoff: pending ? pending.date_start : m.date_start,
              status,
              daysLeft: d,
            };

            const users = recipients || [];
            if (users.length === 0) continue;
            await Promise.all(
              users.map((u) =>
                emailService.sendMatchAgreementReminderEmail(u, ctx)
              )
            );
          }
        } catch (err) {
          logger.error('matchAgreementReminders failed: %s', err.stack || err);
          throw err;
        }
      })
  );
}

export default function startMatchAgreementReminderCron() {
  const schedule = process.env.MATCH_REMINDER_CRON || '0 9 * * *';
  cron.schedule(schedule, runMatchAgreementReminders, {
    timezone: 'Europe/Moscow',
  });
}

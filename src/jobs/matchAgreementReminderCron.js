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
  GameStatus,
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

export async function runMatchAgreementReminders() {
  await withRedisLock(
    buildJobLockKey('matchAgreementReminders'),
    30 * 60_000,
    async () =>
      withJobMetrics('matchAgreementReminders', async () => {
        try {
          const now = new Date();
          const horizonDays = Math.max(
            7,
            parseInt(process.env.MATCH_REMINDER_HORIZON_DAYS || '14', 10)
          );
          const horizon = new Date(
            now.getTime() + horizonDays * 24 * 60 * 60 * 1000
          );

          // Load upcoming matches
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
              { model: GameStatus, attributes: ['alias'] },
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
                    'created_at',
                    'decision_reminded_at',
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
          for (const p of pendings)
            if (!pendingByMatch.has(p.match_id))
              pendingByMatch.set(p.match_id, p);

          // Build digests per team: { teamId: { assign: [], decide: [], recipients: [] } }
          const digests = new Map();

          function addDigest(teamId, kind, item) {
            if (!teamId) return;
            if (!digests.has(teamId))
              digests.set(teamId, { assign: [], decide: [], recipients: null });
            digests.get(teamId)[kind].push(item);
          }

          // Section A: Assign time (no proposal) — only when < 7 days left, daily at 09:00
          for (const m of matches) {
            const statusAlias = (m.GameStatus?.alias || '').toUpperCase();
            if (
              statusAlias === 'CANCELLED' ||
              statusAlias === 'POSTPONED' ||
              statusAlias === 'FINISHED' ||
              statusAlias === 'LIVE'
            )
              continue;
            if (acceptedSet.has(m.id)) continue;
            const d = daysLeftMsk(m.date_start);
            if (d < 0 || d >= 7) continue; // strictly less than 7 days
            const pending = pendingByMatch.get(m.id) || null;
            if (pending) continue; // there is a proposal — skip assign bucket
            addDigest(m.team1_id, 'assign', {
              matchId: m.id,
              team1: m.HomeTeam?.name || 'Команда 1',
              team2: m.AwayTeam?.name || 'Команда 2',
              tournament: m.Tournament?.name || '',
              group: m.TournamentGroup?.name || '',
              tour: m.Tour?.name || '',
              ground: m.Ground?.name || '',
              kickoff: m.date_start,
              daysLeft: d,
            });
          }

          // Section B: Decide (pending > 24h, remind next morning only once)
          const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          for (const p of pendings) {
            if (!p.created_at || p.created_at > dayAgo) continue;
            if (p.decision_reminded_at) continue; // already reminded once
            const m = matches.find((mm) => mm.id === p.match_id);
            if (!m) continue;
            const statusAlias = (m.GameStatus?.alias || '').toUpperCase();
            if (
              statusAlias === 'CANCELLED' ||
              statusAlias === 'POSTPONED' ||
              statusAlias === 'FINISHED' ||
              statusAlias === 'LIVE'
            )
              continue;
            const d = daysLeftMsk(m.date_start);
            const typeAlias = typeById.get(p.type_id);
            const targetTeamId =
              typeAlias === 'HOME_PROPOSAL'
                ? m.team2_id
                : typeAlias === 'AWAY_COUNTER'
                  ? m.team1_id
                  : null;
            addDigest(targetTeamId, 'decide', {
              matchId: m.id,
              team1: m.HomeTeam?.name || 'Команда 1',
              team2: m.AwayTeam?.name || 'Команда 2',
              tournament: m.Tournament?.name || '',
              group: m.TournamentGroup?.name || '',
              tour: m.Tour?.name || '',
              ground: p.ground_id ? m.Ground?.name || '' : m.Ground?.name || '',
              kickoff: p.date_start || m.date_start,
              daysLeft: d,
              agreementId: p.id,
            });
          }

          // Resolve recipients per team and send one digest per user
          for (const [teamId, data] of digests.entries()) {
            if (!data.assign.length && !data.decide.length) continue;
            if (!data.recipients) {
              try {
                const users = (await listTeamUsers(teamId)) || [];
                data.recipients = users.filter((u) => u.email);
              } catch {
                data.recipients = [];
              }
            }
            if (!data.recipients.length) continue;
            await Promise.all(
              data.recipients.map((u) =>
                emailService.sendMatchAgreementDailyDigestEmail(u, {
                  assign: data.assign,
                  decide: data.decide,
                })
              )
            );
          }

          // Mark decision reminders as sent when at least one email has been issued for that team
          const remindedSet = new Set();
          for (const data of digests.values()) {
            if (!data.decide.length) continue;
            if (!data.recipients || !data.recipients.length) continue; // no recipients => try next day
            for (const item of data.decide) remindedSet.add(item.agreementId);
          }
          if (remindedSet.size) {
            await MatchAgreement.update(
              { decision_reminded_at: new Date() },
              { where: { id: { [Op.in]: Array.from(remindedSet) } } }
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

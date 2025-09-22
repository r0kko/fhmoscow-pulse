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
  UserClub,
  SportSchoolPosition,
} from '../models/index.js';
import emailService from '../services/emailService.js';
import { listUsersForTeams } from '../services/teamService.js';
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

          // Build digests per team: { teamId: { assign: [], decide: [], teamName, clubId } }
          const digests = new Map();

          function ensureTeamDigest(teamId) {
            if (!teamId) return null;
            if (!digests.has(teamId))
              digests.set(teamId, {
                teamId,
                teamName: null,
                clubId: null,
                assign: [],
                decide: [],
              });
            return digests.get(teamId);
          }

          function addDigest(teamId, kind, item, meta = {}) {
            if (!teamId) return;
            const digest = ensureTeamDigest(teamId);
            if (!digest) return;
            if (meta.teamName && !digest.teamName)
              digest.teamName = meta.teamName;
            digest[kind].push(item);
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
            addDigest(
              m.team1_id,
              'assign',
              {
                matchId: m.id,
                teamId: m.team1_id,
                team1: m.HomeTeam?.name || 'Команда 1',
                team2: m.AwayTeam?.name || 'Команда 2',
                tournament: m.Tournament?.name || '',
                group: m.TournamentGroup?.name || '',
                tour: m.Tour?.name || '',
                ground: m.Ground?.name || '',
                kickoff: m.date_start,
                daysLeft: d,
              },
              { teamName: m.HomeTeam?.name || 'Команда 1' }
            );
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
            const teamName =
              targetTeamId === m.team1_id
                ? m.HomeTeam?.name || 'Команда 1'
                : targetTeamId === m.team2_id
                  ? m.AwayTeam?.name || 'Команда 2'
                  : null;
            addDigest(
              targetTeamId,
              'decide',
              {
                matchId: m.id,
                teamId: targetTeamId,
                team1: m.HomeTeam?.name || 'Команда 1',
                team2: m.AwayTeam?.name || 'Команда 2',
                tournament: m.Tournament?.name || '',
                group: m.TournamentGroup?.name || '',
                tour: m.Tour?.name || '',
                ground: p.ground_id
                  ? m.Ground?.name || ''
                  : m.Ground?.name || '',
                kickoff: p.date_start || m.date_start,
                daysLeft: d,
                agreementId: p.id,
              },
              { teamName }
            );
          }

          if (!digests.size) return;

          const teamIds = Array.from(digests.keys());

          const teamsMeta = await Team.findAll({
            where: { id: { [Op.in]: teamIds } },
            attributes: ['id', 'name', 'club_id'],
          });
          for (const team of teamsMeta) {
            const digest = digests.get(team.id);
            if (!digest) continue;
            digest.clubId = team.club_id || null;
            if (!digest.teamName) digest.teamName = team.name || null;
          }

          const clubIds = Array.from(
            new Set(
              Array.from(digests.values())
                .map((d) => d.clubId)
                .filter((id) => id)
            )
          );

          const memberships = clubIds.length
            ? await UserClub.findAll({
                where: { club_id: { [Op.in]: clubIds } },
                attributes: ['user_id', 'club_id', 'sport_school_position_id'],
                include: [
                  {
                    model: SportSchoolPosition,
                    as: 'SportSchoolPosition',
                    attributes: ['alias'],
                  },
                ],
              })
            : [];

          const clubRoleMap = new Map();
          for (const membership of memberships) {
            const clubId = membership.club_id;
            if (!clubRoleMap.has(clubId))
              clubRoleMap.set(clubId, {
                roles: new Map(),
                counts: new Map(),
                members: new Set(),
              });
            const container = clubRoleMap.get(clubId);
            const alias =
              membership.SportSchoolPosition?.alias?.toUpperCase() || null;
            container.roles.set(membership.user_id, alias);
            container.members.add(membership.user_id);
            if (alias)
              container.counts.set(
                alias,
                (container.counts.get(alias) || 0) + 1
              );
          }

          const teamUsersMap = await listUsersForTeams(teamIds);

          const clubUsersByTeam = new Map();
          for (const [teamId, users] of teamUsersMap.entries()) {
            const teamDigest = digests.get(teamId);
            if (!teamDigest?.clubId) continue;
            if (!clubUsersByTeam.has(teamDigest.clubId))
              clubUsersByTeam.set(teamDigest.clubId, new Set());
            const set = clubUsersByTeam.get(teamDigest.clubId);
            for (const user of users || []) if (user?.id) set.add(user.id);
          }

          const userDigests = new Map();

          function clubMemberSet(clubId) {
            const teamSet = clubUsersByTeam.get(clubId) || null;
            const roleSet = clubRoleMap.get(clubId)?.members || null;
            if (!teamSet && !roleSet) return null;
            if (teamSet && !roleSet) return teamSet;
            if (!teamSet && roleSet) return roleSet;
            const merged = new Set(teamSet);
            for (const value of roleSet) merged.add(value);
            return merged;
          }

          function shouldNotifyUserForClub(userId, clubId) {
            if (!clubId) return true;
            const clubData = clubRoleMap.get(clubId);
            const members = clubMemberSet(clubId);
            const memberCount = members?.size || 0;
            if (!clubData) return true;
            const alias = clubData.roles.get(userId) || null;
            if (!alias) return true;
            if (alias === 'ADMINISTRATOR' || alias === 'METHODIST') return true;
            if (alias === 'DIRECTOR')
              return (
                (clubData.counts.get('DIRECTOR') || 0) === 1 && memberCount <= 1
              );
            return false;
          }

          function ensureUserDigest(user) {
            if (!userDigests.has(user.id))
              userDigests.set(user.id, {
                user,
                totals: { assign: 0, decide: 0 },
                teams: new Map(),
              });
            return userDigests.get(user.id);
          }

          function ensureTeamEntry(userDigest, teamDigest) {
            if (userDigest.teams.has(teamDigest.teamId)) {
              const entry = userDigest.teams.get(teamDigest.teamId);
              if (!entry.teamName && teamDigest.teamName)
                entry.teamName = teamDigest.teamName;
              return entry;
            }
            const entry = {
              teamId: teamDigest.teamId,
              teamName: teamDigest.teamName || '',
              assign: [],
              decide: [],
            };
            userDigest.teams.set(teamDigest.teamId, entry);
            return entry;
          }

          for (const teamDigest of digests.values()) {
            if (!teamDigest.assign.length && !teamDigest.decide.length)
              continue;
            const users = teamUsersMap.get(teamDigest.teamId) || [];
            if (!users.length) continue;
            const seenUsers = new Set();
            for (const rawUser of users) {
              if (!rawUser?.id || seenUsers.has(rawUser.id)) continue;
              seenUsers.add(rawUser.id);
              if (!rawUser.email) continue;
              if (!shouldNotifyUserForClub(rawUser.id, teamDigest.clubId))
                continue;
              const userDigest = ensureUserDigest(rawUser);
              const teamEntry = ensureTeamEntry(userDigest, teamDigest);
              for (const item of teamDigest.assign) {
                teamEntry.assign.push({ ...item });
                userDigest.totals.assign += 1;
              }
              for (const item of teamDigest.decide) {
                teamEntry.decide.push({ ...item });
                userDigest.totals.decide += 1;
              }
            }
          }

          const remindedSet = new Set();

          const compareByKickoff = (a, b) => {
            const safeTime = (value) => {
              if (!value) return Number.MAX_SAFE_INTEGER;
              const ts = new Date(value).getTime();
              return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
            };
            return safeTime(a?.kickoff) - safeTime(b?.kickoff);
          };

          const collator =
            typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
              ? new Intl.Collator('ru', { sensitivity: 'base' })
              : null;

          for (const { user, totals, teams } of userDigests.values()) {
            const teamsArray = Array.from(teams.values())
              .filter((team) => team.assign.length || team.decide.length)
              .map((team) => ({
                ...team,
                assign: [...team.assign].sort(compareByKickoff),
                decide: [...team.decide].sort(compareByKickoff),
              }))
              .sort((a, b) => {
                const nameA = a.teamName || '';
                const nameB = b.teamName || '';
                return collator
                  ? collator.compare(nameA, nameB)
                  : nameA.localeCompare(nameB);
              });

            if (!teamsArray.length) continue;

            await emailService.sendMatchAgreementDailyDigestEmail(user, {
              totals: {
                assign: totals.assign,
                decide: totals.decide,
              },
              teams: teamsArray,
            });

            for (const team of teamsArray)
              for (const item of team.decide)
                if (item.agreementId) remindedSet.add(item.agreementId);
          }

          // Mark decision reminders as sent when at least one email has been issued that includes them
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

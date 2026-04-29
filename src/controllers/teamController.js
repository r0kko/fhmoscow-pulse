import teamService from '../services/teamService.js';
import clubService from '../services/clubService.js';
import teamParticipationSummaryService from '../services/teamParticipationSummaryService.js';
import matchProtocolBatchExportService from '../services/matchProtocolBatchExportService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

function buildAttachmentDisposition(filename) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export default {
  async create(req, res) {
    try {
      const team = await teamService.createManual(req.body, req.user?.id);
      return res.status(201).json({ team: teamMapper.toPublic(team) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async list(req, res) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        q,
        club_id,
        birth_year,
        status,
        include,
        withGrounds,
      } = req.query;
      const includeGrounds =
        withGrounds === 'true' ||
        include === 'grounds' ||
        (Array.isArray(include) && include.includes('grounds'));
      const { rows, count } = await teamService.list({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        club_id,
        birth_year,
        status,
        includeGrounds,
      });
      return res.json({ teams: rows.map(teamMapper.toPublic), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async participationSummary(req, res) {
    try {
      const data =
        await teamParticipationSummaryService.getParticipationSummary({
          teamId: req.params.id,
          seasonId: req.query.season_id,
          access: req.access,
        });
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async participationSummaryIasEvents(req, res) {
    try {
      const data =
        await teamParticipationSummaryService.listParticipationSummaryIasEvents(
          {
            teamId: req.params.id,
            seasonId: req.query.season_id,
            access: req.access,
          }
        );
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async exportParticipationSummary(req, res) {
    try {
      const payload =
        await teamParticipationSummaryService.exportParticipationSummaryXlsx({
          teamId: req.params.id,
          seasonId: req.body?.season_id || req.query.season_id,
          playerIds: req.body?.player_ids || req.query.player_ids,
          access: req.access,
          moscowOnly:
            req.body?.moscow_only === true ||
            req.body?.moscow_only === 'true' ||
            req.query?.moscow_only === 'true',
        });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        buildAttachmentDisposition(payload.filename)
      );
      return res.send(payload.buffer);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async exportParticipationSummarySignedPdf(req, res) {
    try {
      const payload =
        await teamParticipationSummaryService.exportParticipationSummarySignedPdf(
          {
            teamId: req.params.id,
            seasonId: req.body?.season_id || req.query.season_id,
            playerIds: req.body?.player_ids || req.query.player_ids,
            access: req.access,
            meta: {
              registry_number: req.body?.registry_number,
              event_name: req.body?.event_name,
              event_date_start: req.body?.event_date_start,
              event_date_end: req.body?.event_date_end,
            },
          }
        );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Disposition',
        buildAttachmentDisposition(payload.filename)
      );
      return res.end(payload.buffer);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async createParticipationSummarySignedDocument(req, res) {
    try {
      const payload =
        await teamParticipationSummaryService.createParticipationSummarySignedDocument(
          {
            teamId: req.params.id,
            seasonId: req.body?.season_id || req.query.season_id,
            playerIds: req.body?.player_ids || req.query.player_ids,
            iasEventId: req.body?.ias_event_id || req.query.ias_event_id,
            eventDateStart:
              req.body?.event_date_start || req.query.event_date_start,
            eventDateEnd: req.body?.event_date_end || req.query.event_date_end,
            moscowOnly:
              req.body?.moscow_only === true ||
              req.body?.moscow_only === 'true' ||
              req.query?.moscow_only === 'true',
            access: req.access,
            actorId: req.user?.id || null,
          }
        );
      return res.status(201).json(payload);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async createProtocolExportJob(req, res) {
    try {
      const payload = await matchProtocolBatchExportService.createExportJob({
        teamId: req.params.id,
        seasonId: req.body?.season_id || req.query.season_id,
        playerIds: req.body?.player_ids || req.query.player_ids,
        moscowOnly:
          req.body?.moscow_only === true ||
          req.body?.moscow_only === 'true' ||
          req.query?.moscow_only === 'true',
        access: req.access,
        actorId: req.user?.id || null,
        requestId: req.id || null,
      });
      return res.status(202).json(payload);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async protocolExportJob(req, res) {
    try {
      const payload = await matchProtocolBatchExportService.getExportJob({
        teamId: req.params.id,
        jobId: req.params.jobId,
        access: req.access,
      });
      return res.json(payload);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async downloadProtocolExport(req, res) {
    try {
      const payload =
        await matchProtocolBatchExportService.downloadExportArchive({
          teamId: req.params.id,
          jobId: req.params.jobId,
          access: req.access,
        });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        buildAttachmentDisposition(payload.filename)
      );
      return res.end(payload.buffer);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
      // Keep clubs in sync first to maintain relations and accurate soft-deletes
      let payload = null;
      const requestedMode = String(
        req.body?.mode || req.query?.mode || ''
      ).toLowerCase();
      const modeOverride =
        requestedMode === 'full'
          ? 'full'
          : requestedMode === 'incremental'
            ? 'incremental'
            : null;
      await withRedisLock(
        buildJobLockKey('teamSync'),
        30 * 60_000,
        async () => {
          await withJobMetrics('teamSync_manual', async () => {
            const clubRun = await runWithSyncState(
              'clubSync',
              async ({ mode, since }) => {
                const stats = await clubService.syncExternal({
                  actorId: req.user?.id,
                  mode,
                  since,
                });
                return {
                  cursor: stats.cursor,
                  stats,
                  fullSync: stats.fullSync === true,
                };
              },
              modeOverride ? { forceMode: modeOverride } : undefined
            );
            const teamRun = await runWithSyncState(
              'teamSync',
              async ({ mode, since }) => {
                const stats = await teamService.syncExternal({
                  actorId: req.user?.id,
                  mode,
                  since,
                });
                return {
                  cursor: stats.cursor,
                  stats,
                  fullSync: stats.fullSync === true,
                };
              },
              modeOverride ? { forceMode: modeOverride } : undefined
            );
            const clubStats = clubRun.outcome?.stats || {};
            const teamStats = teamRun.outcome?.stats || {};
            const teams = await teamService.listAll();
            payload = {
              stats: { clubs: clubStats, teams: teamStats },
              modes: { clubs: clubRun.mode, teams: teamRun.mode },
              cursors: {
                clubs: clubRun.cursor ? clubRun.cursor.toISOString() : null,
                teams: teamRun.cursor ? teamRun.cursor.toISOString() : null,
              },
              states: { clubs: clubRun.state, teams: teamRun.state },
              teams: teams.map(teamMapper.toPublic),
            };
          });
        },
        { onBusy: () => null }
      );
      if (payload) return res.json(payload);
      return res.status(409).json({ error: 'sync_in_progress' });
    } catch (err) {
      return sendError(res, err);
    }
  },
};

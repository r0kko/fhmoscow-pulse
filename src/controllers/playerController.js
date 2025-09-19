import playerService, {
  seasonBirthYearCounts,
  seasonTeamSummaries,
} from '../services/playerService.js';
import { PlayerRole, ClubPlayer } from '../models/index.js';
import teamService from '../services/teamService.js';
import clubService from '../services/clubService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import playerMapper from '../mappers/playerMapper.js';
import { sendError } from '../utils/api.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import playerPhotoRequestService from '../services/playerPhotoRequestService.js';
import playerPhotoRequestMapper from '../mappers/playerPhotoRequestMapper.js';

export default {
  async gallery(req, res) {
    try {
      const {
        page = '1',
        limit = '40',
        search,
        q,
        club_id,
        team_id,
        mine,
        season_id,
        require_contract,
        require_photo,
        without_photo,
        photo_filter,
        team_birth_year,
      } = req.query;
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const allowedClubIds = (scope.allowedClubIds || []).map((id) =>
        String(id)
      );
      const allowedTeamIds = (scope.allowedTeamIds || []).map((id) =>
        String(id)
      );
      const requestedClubId = club_id ? String(club_id) : null;
      const requestedTeamId = team_id ? String(team_id) : null;

      const useScopedAccess = !isAdmin || mine === 'true';
      let clubIds = [];
      let teamIds = [];

      if (useScopedAccess) {
        if (!allowedClubIds.length && !allowedTeamIds.length) {
          return res.status(403).json({ error: 'Доступ запрещён' });
        }
        if (requestedClubId) {
          if (!allowedClubIds.includes(requestedClubId)) {
            return res.status(403).json({ error: 'Доступ запрещён' });
          }
          clubIds = [requestedClubId];
        } else {
          clubIds = [...allowedClubIds];
        }
        if (requestedTeamId) {
          if (!allowedTeamIds.includes(requestedTeamId)) {
            return res.status(403).json({ error: 'Доступ запрещён' });
          }
          teamIds = [requestedTeamId];
        } else {
          teamIds = [...allowedTeamIds];
        }
      } else {
        if (requestedClubId) clubIds = [requestedClubId];
        if (requestedTeamId) teamIds = [requestedTeamId];
      }

      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 40));
      const pageNum = Math.max(1, parseInt(page, 10) || 1);

      const seasonIds = season_id
        ? String(season_id)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : [];
      const teamBirthYears = team_birth_year
        ? String(team_birth_year)
            .split(',')
            .map((val) => val.trim())
            .filter(Boolean)
        : [];
      const normalizedPhotoFilter = (photo_filter || '').toLowerCase();
      const requirePhotoFlag =
        require_photo === 'true' || normalizedPhotoFilter === 'with';
      const requirePhotoMissingFlag =
        without_photo === 'true' || normalizedPhotoFilter === 'without';
      if (requirePhotoFlag && requirePhotoMissingFlag) {
        return res
          .status(400)
          .json({ error: 'Некорректный фильтр фотографий' });
      }
      const result = await playerService.listForGallery({
        page: pageNum,
        limit: limitNum,
        search: search || q || undefined,
        clubIds,
        teamIds,
        seasonIds,
        requireActiveClub: require_contract !== 'false',
        requirePhoto: requirePhotoFlag,
        requirePhotoMissing: requirePhotoMissingFlag,
        teamBirthYears,
      });

      const players = result.rows.map(playerMapper.toPublic);
      const total = Number(result.count || 0);
      const perPage = Number(result.pageSize || limitNum);
      const totalPages = perPage ? Math.ceil(total / perPage) : 0;
      const currentPage = Math.min(
        result.page || pageNum,
        totalPages || pageNum
      );

      return res.json({
        players,
        total,
        page: currentPage,
        per_page: perPage,
        total_pages: totalPages,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async galleryFilters(req, res) {
    try {
      const { mine, club_id } = req.query;
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const allowedClubIds = (scope.allowedClubIds || []).map((id) =>
        String(id)
      );
      const allowedTeamIds = (scope.allowedTeamIds || []).map((id) =>
        String(id)
      );
      const requestedClubId = club_id ? String(club_id) : null;

      const respondForbidden = () =>
        res.status(403).json({ error: 'Доступ запрещён' });

      if (!isAdmin || mine === 'true') {
        if (!allowedClubIds.length && !allowedTeamIds.length) {
          return respondForbidden();
        }
        if (requestedClubId && !allowedClubIds.includes(requestedClubId)) {
          return respondForbidden();
        }
        const payload = await playerService.listGalleryFilters({
          clubIds: allowedClubIds,
          teamIds: allowedTeamIds,
          filterClubId: requestedClubId || undefined,
        });
        return res.json(payload);
      }

      const scopedClubIds = (scope.allowedClubIds || []).map((id) =>
        String(id)
      );
      if (
        requestedClubId &&
        scopedClubIds.length &&
        !scopedClubIds.includes(requestedClubId)
      ) {
        return respondForbidden();
      }
      const payload = await playerService.listGalleryFilters({
        clubIds: scopedClubIds,
        teamIds: allowedTeamIds,
        filterClubId: requestedClubId || undefined,
      });
      return res.json(payload);
    } catch (err) {
      return sendError(res, err);
    }
  },
  async seasonSummary(req, res) {
    try {
      const { mine, club_id } = req.query;
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const allowedClubIds = scope.allowedClubIds || [];
      const allowedTeamIds = scope.allowedTeamIds || [];
      let clubIds = [];
      let teamIds = [];

      if (mine === 'true') {
        if (!allowedClubIds.length && !allowedTeamIds.length) {
          return res.status(403).json({ error: 'Доступ запрещён' });
        }
        // If club filter is provided, ensure it's within personal scope
        if (club_id) {
          if (!allowedClubIds.includes(club_id)) {
            return res.status(403).json({ error: 'Доступ запрещён' });
          }
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        teamIds = allowedTeamIds;
      } else if (isAdmin) {
        if (club_id) clubIds = [club_id];
      } else {
        if (!allowedClubIds.length && !allowedTeamIds.length) {
          return res.status(403).json({ error: 'Доступ запрещён' });
        }
        if (club_id) {
          if (!allowedClubIds.includes(club_id)) {
            return res.status(403).json({ error: 'Доступ запрещён' });
          }
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        teamIds = allowedTeamIds;
      }

      const rows = await seasonBirthYearCounts({ clubIds, teamIds });
      // Group by season
      const bySeason = new Map();
      for (const r of rows) {
        if (!bySeason.has(r.season_id)) {
          bySeason.set(r.season_id, {
            id: r.season_id,
            name: r.season_name,
            active: Boolean(r.season_active),
            years: [],
          });
        }
        bySeason
          .get(r.season_id)
          .years.push({ year: r.birth_year, count: Number(r.player_count) });
      }
      const seasons = Array.from(bySeason.values());
      return res.json({ seasons });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async facets(req, res) {
    try {
      const { search, q, season, club_id, team_id, birth_year, mine } =
        req.query;
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const allowedClubIds = scope.allowedClubIds || [];
      const allowedTeamIds = scope.allowedTeamIds || [];
      let clubIds = [];

      if (mine === 'true') {
        if (!allowedClubIds.length && !allowedTeamIds.length) {
          return res.status(403).json({ error: 'Доступ запрещён' });
        }
        if (club_id) {
          if (!allowedClubIds.includes(club_id))
            return res.status(403).json({ error: 'Доступ запрещён' });
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        if (team_id && !allowedTeamIds.includes(team_id))
          return res.status(403).json({ error: 'Доступ запрещён' });
      } else if (isAdmin) {
        if (club_id) clubIds = [club_id];
      } else {
        if (!allowedClubIds.length && !allowedTeamIds.length) {
          return res.status(403).json({ error: 'Доступ запрещён' });
        }
        if (club_id) {
          if (!allowedClubIds.includes(club_id))
            return res.status(403).json({ error: 'Доступ запрещён' });
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        if (team_id && !allowedTeamIds.includes(team_id))
          return res.status(403).json({ error: 'Доступ запрещён' });
      }

      const facets = await playerService.facets({
        search: search || q || undefined,
        seasonId: season || undefined,
        teamId: team_id || undefined,
        birthYear: birth_year ? parseInt(birth_year, 10) : undefined,
        clubIds,
      });
      return res.json(facets);
    } catch (err) {
      return sendError(res, err);
    }
  },
  async seasonTeamSummary(req, res) {
    try {
      const { mine, club_id } = req.query;
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const allowedClubIds = scope.allowedClubIds || [];
      const allowedTeamIds = scope.allowedTeamIds || [];
      let clubIds = [];
      let teamIds = [];

      if (mine === 'true') {
        if (!allowedClubIds.length && !allowedTeamIds.length) {
          return res.status(403).json({ error: 'Доступ запрещён' });
        }
        if (club_id) {
          if (!allowedClubIds.includes(club_id))
            return res.status(403).json({ error: 'Доступ запрещён' });
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        teamIds = allowedTeamIds;
      } else if (isAdmin) {
        if (club_id) clubIds = [club_id];
      } else {
        if (!allowedClubIds.length && !allowedTeamIds.length) {
          return res.status(403).json({ error: 'Доступ запрещён' });
        }
        if (club_id) {
          if (!allowedClubIds.includes(club_id))
            return res.status(403).json({ error: 'Доступ запрещён' });
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        teamIds = allowedTeamIds;
      }

      const rows = await seasonTeamSummaries({ clubIds, teamIds });
      // Group by season
      const bySeason = new Map();
      for (const r of rows) {
        if (!bySeason.has(r.season_id)) {
          bySeason.set(r.season_id, {
            id: r.season_id,
            name: r.season_name,
            active: Boolean(r.season_active),
            teams: [],
          });
        }
        bySeason.get(r.season_id).teams.push({
          team_id: r.team_id,
          team_name: r.team_name,
          birth_year: r.birth_year,
          player_count: Number(r.player_count) || 0,
          tournaments: r.tournaments || [],
        });
      }
      const seasons = Array.from(bySeason.values());
      // Sort inner teams by birth_year desc then team_name
      for (const s of seasons) {
        s.teams.sort((a, b) => {
          if (a.birth_year !== b.birth_year)
            return (b.birth_year || 0) - (a.birth_year || 0);
          return (a.team_name || '').localeCompare(b.team_name || '', 'ru');
        });
      }
      return res.json({ seasons });
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
        status,
        include,
        withTeams,
        withClubs,
        season,
        club_id,
        team_id,
        birth_year,
        mine,
      } = req.query;

      const includeTeams =
        withTeams === 'true' ||
        include === 'teams' ||
        (Array.isArray(include) && include.includes('teams'));
      const includeClubs =
        withClubs === 'true' ||
        include === 'clubs' ||
        (Array.isArray(include) && include.includes('clubs'));

      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const allowedClubIds = scope.allowedClubIds || [];
      const allowedTeamIds = scope.allowedTeamIds || [];
      let clubIds = [];

      if (mine === 'true') {
        if (!allowedClubIds.length && !allowedTeamIds.length)
          return res.status(403).json({ error: 'Доступ запрещён' });
        if (club_id) {
          if (!allowedClubIds.includes(club_id))
            return res.status(403).json({ error: 'Доступ запрещён' });
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        if (team_id && !allowedTeamIds.includes(team_id))
          return res.status(403).json({ error: 'Доступ запрещён' });
      } else if (isAdmin) {
        if (club_id) clubIds = [club_id];
      } else {
        if (!allowedClubIds.length && !allowedTeamIds.length)
          return res.status(403).json({ error: 'Доступ запрещён' });
        if (club_id) {
          if (!allowedClubIds.includes(club_id))
            return res.status(403).json({ error: 'Доступ запрещён' });
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        if (team_id && !allowedTeamIds.includes(team_id))
          return res.status(403).json({ error: 'Доступ запрещён' });
      }

      const { rows, count } = await playerService.list({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        status,
        includeTeams,
        includeClubs,
        clubIds,
        seasonId: season || undefined,
        teamId: team_id || undefined,
        birthYear: birth_year ? parseInt(birth_year, 10) : undefined,
        allowedTeamIds,
        teamBirthYear: req.query.team_birth_year
          ? parseInt(req.query.team_birth_year, 10)
          : undefined,
        requireTeamWithinClub: clubIds.length > 0,
      });
      const isRosterContext = Boolean(season && req.query.team_birth_year);

      // Option A: single club — preload role names
      let roleNameById = new Map();
      if (clubIds.length === 1) {
        const roleIds = new Set();
        for (const p of rows) {
          if (p.Clubs) {
            const club = p.Clubs.find(
              (c) => String(c.id) === String(clubIds[0])
            );
            const roleId = club?.ClubPlayer?.role_id || null;
            if (roleId) roleIds.add(roleId);
          }
        }
        if (roleIds.size) {
          const roles = await PlayerRole.findAll({
            where: { id: Array.from(roleIds) },
          });
          roleNameById = new Map(roles.map((r) => [r.id, r.name || null]));
        }
      }

      // Option B: roster context — enrich via TeamPlayer.club_player_id
      let clubPlayerMetaById = new Map();
      if (isRosterContext) {
        const cpIds = new Set();
        for (const p of rows) {
          if (p.Teams) {
            for (const t of p.Teams) {
              const cpId = t?.TeamPlayer?.club_player_id || null;
              if (cpId) cpIds.add(cpId);
            }
          }
        }
        if (cpIds.size) {
          const cps = await ClubPlayer.findAll({
            where: { id: Array.from(cpIds) },
            include: [{ model: PlayerRole, required: false }],
          });
          clubPlayerMetaById = new Map(
            cps.map((x) => [
              x.id,
              {
                number: x.number ?? null,
                roleName: x.PlayerRole?.name || null,
              },
            ])
          );
        }
      }

      // Map to public and inject jersey_number, role_name
      const mapped = rows.map((p) => {
        const pub = playerMapper.toPublic(p);
        if (clubIds.length === 1 && p.Clubs) {
          const club = p.Clubs.find((c) => String(c.id) === String(clubIds[0]));
          const jersey = club?.ClubPlayer?.number ?? null;
          if (jersey != null) pub.jersey_number = jersey;
          const roleId = club?.ClubPlayer?.role_id || null;
          if (roleId && roleNameById.has(roleId))
            pub.role_name = roleNameById.get(roleId);
        }
        if (isRosterContext && p.Teams) {
          const tp = p.Teams.find((t) => t?.TeamPlayer)?.TeamPlayer || null;
          const meta = tp?.club_player_id
            ? clubPlayerMetaById.get(tp.club_player_id)
            : null;
          if (meta) {
            if (meta.number != null) pub.jersey_number = meta.number;
            if (meta.roleName) pub.role_name = meta.roleName;
          }
        }
        return pub;
      });
      return res.json({ players: mapped, total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
      // keep related entities in sync first
      let payload = null;
      await withRedisLock(
        buildJobLockKey('playerSync'),
        60 * 60_000,
        async () => {
          await withJobMetrics('playerSync_manual', async () => {
            const clubStats = await clubService.syncExternal(req.user?.id);
            const teamStats = await teamService.syncExternal(req.user?.id);
            const stats = await playerService.syncExternal(req.user?.id);
            const { rows, count } = await playerService.list({
              page: 1,
              limit: 100,
            });
            payload = {
              stats: { clubs: clubStats, teams: teamStats, ...stats },
              players: rows.map(playerMapper.toPublic),
              total: count,
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
  async roles(_req, res) {
    try {
      const roles = await PlayerRole.findAll({
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
      });
      return res.json({
        roles: roles.map((r) => ({ id: r.id, name: r.name })),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async updateAnthroAndRoster(req, res) {
    try {
      const { default: playerEditService } = await import(
        '../services/playerEditService.js'
      );
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const allowedClubIds = scope.allowedClubIds || [];
      const allowedTeamIds = scope.allowedTeamIds || [];
      const playerId = req.params.id;
      const { season_id, team_id, club_id } = req.body || {};

      // Enforce access: admin allowed; staff must be attached to the team and club
      if (!isAdmin) {
        if (
          !allowedTeamIds.includes(team_id) ||
          !allowedClubIds.includes(club_id)
        ) {
          return res.status(403).json({ error: 'Доступ запрещён' });
        }
      }

      const updated = await playerEditService.updateAnthropometryAndRoster({
        actor: req.user,
        playerId,
        seasonId: season_id,
        teamId: team_id,
        clubId: club_id,
        grip: req.body?.grip,
        height: req.body?.height,
        weight: req.body?.weight,
        jerseyNumber: req.body?.jersey_number,
        roleId: req.body?.role_id || null,
      });
      return res.json({ ok: true, updated });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async submitPhotoRequest(req, res) {
    try {
      const scope = req.access || {};
      const request = await playerPhotoRequestService.submit({
        actorId: req.user?.id || null,
        playerId: req.params.id,
        file: req.file,
        scope,
      });
      return res.status(201).json({
        request: playerPhotoRequestMapper.toPublic(request),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};

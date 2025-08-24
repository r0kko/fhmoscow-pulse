import { Op } from 'sequelize';

import { Ground, Club, Team, Address } from '../models/index.js';
import groundMapper from '../mappers/groundMapper.js';
import { sendError } from '../utils/api.js';

/**
 * Staff-facing controller to list available grounds grouped by clubs
 * based on user's club/team attachments (SPORT_SCHOOL_STAFF scope).
 */
export default {
  async available(req, res) {
    try {
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const allowedClubIds = scope.allowedClubIds || [];
      const allowedTeamIds = scope.allowedTeamIds || [];

      // Staff must have some scope; admins without staff scope are not allowed here
      if (
        !isAdmin &&
        allowedClubIds.length === 0 &&
        allowedTeamIds.length === 0
      ) {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }

      // Collect all club IDs from direct links and from user's team links
      const teamClubMap = new Map(); // team_id -> club_id
      if (allowedTeamIds.length) {
        const teams = await Team.findAll({
          where: { id: { [Op.in]: allowedTeamIds } },
          attributes: ['id', 'club_id'],
        });
        for (const t of teams) if (t.club_id) teamClubMap.set(t.id, t.club_id);
      }
      const clubIdsSet = new Set([
        ...allowedClubIds,
        ...Array.from(
          new Set(Array.from(teamClubMap.values()).filter(Boolean))
        ),
      ]);

      // Load club metadata (name) for grouping
      const clubs = clubIdsSet.size
        ? await Club.findAll({
            where: { id: { [Op.in]: Array.from(clubIdsSet) } },
            attributes: ['id', 'name'],
          })
        : [];

      // Build result groups: for each club collect grounds linked to club or to user's teams of that club
      const groups = [];
      for (const c of clubs) {
        const teamIdsForClub = Array.from(teamClubMap.entries())
          .filter(([, clubId]) => String(clubId) === String(c.id))
          .map(([teamId]) => teamId);

        // 1) Grounds linked directly to the club
        const byClub = await Ground.findAll({
          include: [
            {
              model: Club,
              where: { id: c.id },
              attributes: [],
              through: { attributes: [] },
              required: true,
            },
          ],
          includeIgnoreAttributes: false,
          order: [['name', 'ASC']],
        });

        // 2) Grounds linked to user's teams of this club
        let byTeams = [];
        if (teamIdsForClub.length) {
          byTeams = await Ground.findAll({
            include: [
              {
                model: Team,
                where: { id: { [Op.in]: teamIdsForClub } },
                attributes: [],
                through: { attributes: [] },
                required: true,
              },
            ],
            includeIgnoreAttributes: false,
            order: [['name', 'ASC']],
          });
        }

        const map = new Map();
        for (const g of byClub) map.set(g.id, g);
        for (const g of byTeams) map.set(g.id, g);
        const merged = Array.from(map.values());

        // Also load address for display (in one go by reloading with Address include if needed)
        // To avoid extra round-trips, re-fetch selected IDs including Address
        const groundIds = merged.map((g) => g.id);
        const detailed = groundIds.length
          ? await Ground.findAll({
              where: { id: { [Op.in]: groundIds } },
              include: [{ model: Address }],
              order: [['name', 'ASC']],
            })
          : [];

        groups.push({
          club: { id: c.id, name: c.name },
          grounds: detailed.map(groundMapper.toPublic),
        });
      }

      // Sort groups by club name for stable UI
      groups.sort((a, b) =>
        (a.club.name || '').localeCompare(b.club.name || '', 'ru')
      );

      return res.json({ groups });
    } catch (err) {
      return sendError(res, err);
    }
  },
};

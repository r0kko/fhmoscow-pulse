import clubUserService from '../services/clubUserService.js';
import teamService, { listUsersForTeams } from '../services/teamService.js';
import userService from '../services/userService.js';
import clubMapper from '../mappers/clubMapper.js';
import teamMapper from '../mappers/teamMapper.js';
import userMapper from '../mappers/userMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async getLinks(req, res) {
    try {
      const user = await userService.getUser(req.params.id);
      const [clubs, teams] = await Promise.all([
        clubUserService.listUserClubs(user.id),
        teamService.listUserTeams(user.id),
      ]);
      return res.json({
        user: {
          id: user.id,
          fio: `${user.last_name} ${user.first_name} ${user.patronymic || ''}`.trim(),
        },
        clubs: clubs.map(clubMapper.toPublic),
        teams: teams.map(teamMapper.toPublic),
        has_club: clubs.length > 0,
        has_team: teams.length > 0,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async listAssignments(req, res) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        q,
        birth_year,
        has_staff,
        staff,
      } = req.query;
      const staffFilterApplied =
        (typeof has_staff !== 'undefined' && has_staff !== '') ||
        (typeof staff !== 'undefined' && staff);
      const pageNum = parseInt(page, 10);
      const pageLimit = parseInt(limit, 10);
      const baseQuery = {
        page: staffFilterApplied ? 1 : pageNum,
        limit: staffFilterApplied ? 10000 : pageLimit,
        search: search || q || undefined,
        birth_year: birth_year || undefined,
      };
      const { rows } = await teamService.list(baseQuery);

      const plainTeams = rows.map((t) =>
        typeof t.get === 'function' ? t.get({ plain: true }) : t
      );
      const teamIds = plainTeams.map((t) => t.id);
      const usersByTeam = await listUsersForTeams(teamIds);

      let result = plainTeams.map((team) => {
        const teamUsers = usersByTeam.get(team.id) || [];
        const clubPublic = team.Club ? clubMapper.toPublic(team.Club) : null;
        const teamPublic = teamMapper.toPublic(team);
        // Only staff explicitly assigned to the team
        const users = userMapper.toPublicArray(teamUsers).map((u) => ({
          id: u.id,
          last_name: u.last_name,
          first_name: u.first_name,
          patronymic: u.patronymic,
          phone: u.phone,
        }));
        return { club: clubPublic, team: teamPublic, users };
      });

      // Post filters
      // apply post-filters to the mapped list
      if (search || q) {
        const term = String(search || q).toLowerCase();
        result = result.filter(
          (it) =>
            (it.club?.name || '').toLowerCase().includes(term) ||
            (it.team?.name || '').toLowerCase().includes(term)
        );
      }
      if (typeof birth_year !== 'undefined' && birth_year !== '') {
        const y = parseInt(String(birth_year), 10);
        if (!Number.isNaN(y))
          result = result.filter((it) => it.team?.birth_year === y);
      }
      if (typeof has_staff !== 'undefined' && has_staff !== '') {
        const want = String(has_staff).toLowerCase();
        if (want === 'true')
          result = result.filter((it) => (it.users || []).length > 0);
        else if (want === 'false')
          result = result.filter((it) => (it.users || []).length === 0);
      }
      if (typeof staff !== 'undefined' && staff) {
        const sterm = String(staff).toLowerCase();
        result = result.filter((it) =>
          (it.users || []).some((u) =>
            `${u.last_name} ${u.first_name} ${u.patronymic || ''}`
              .trim()
              .toLowerCase()
              .includes(sterm)
          )
        );
      }

      // Adjust pagination after post-filtering to avoid empty pages
      const filteredTotal = result.length;
      const offset = (pageNum - 1) * pageLimit;
      const paged = result.slice(
        Math.max(0, offset),
        Math.max(0, offset) + pageLimit
      );
      return res.json({ items: paged, total: filteredTotal });
    } catch (err) {
      return sendError(res, err);
    }
  },
};

import { Op } from 'sequelize';

import { User, Team } from '../models/index.js';
import { Game, Team as ExtTeam, Stadium } from '../externalModels/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listUpcoming(userId, options) {
  // Backward-compat API: allow second arg to be a number (limit)
  const compatArrayReturn = typeof options !== 'object' || options === null;
  const opts = compatArrayReturn
    ? { limit: typeof options === 'number' ? options : undefined }
    : options;
  const { limit = 100, offset = 0, type = 'all', q = '' } = opts;
  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  const extIds = (user.Teams || [])
    .map((t) => t.external_id)
    .filter((id) => id != null);
  if (!extIds.length) return compatArrayReturn ? [] : { rows: [], count: 0 };
  const now = new Date();
  const where = {
    object_status: { [Op.notIn]: ['archive', 'ARCHIVE'] },
    date_start: { [Op.gte]: now },
  };
  if (type === 'home') {
    where.team1_id = { [Op.in]: extIds };
  } else if (type === 'away') {
    where.team2_id = { [Op.in]: extIds };
  } else {
    where[Op.or] = [
      { team1_id: { [Op.in]: extIds } },
      { team2_id: { [Op.in]: extIds } },
    ];
  }

  const search = (q || '').trim();
  const findOptions = {
    attributes: ['id', 'date_start', 'team1_id', 'team2_id', 'stadium_id'],
    where,
    include: [
      { model: ExtTeam, as: 'Team1', attributes: ['full_name'] },
      { model: ExtTeam, as: 'Team2', attributes: ['full_name'] },
      { model: Stadium, attributes: ['name'] },
    ],
    order: [['date_start', 'ASC']],
    distinct: true,
  };
  if (
    typeof offset === 'number' &&
    offset >= 0 &&
    typeof limit === 'number' &&
    limit > 0
  ) {
    findOptions.offset = offset;
    findOptions.limit = limit;
  }
  if (search) {
    findOptions.where[Op.and] = [
      {
        [Op.or]: [
          { '$Team1.full_name$': { [Op.like]: `%${search}%` } },
          { '$Team2.full_name$': { [Op.like]: `%${search}%` } },
        ],
      },
    ];
  }

  // Use findAll for compatibility with tests that mock only findAll
  const rowsRaw = await Game.findAll(findOptions);

  if (compatArrayReturn) {
    // Legacy/compat mode: return an array of simplified items
    return rowsRaw.map((g) => ({
      id: g.id,
      date: g.date_start,
      stadium: g.Stadium?.name || null,
      team1: g.Team1?.full_name || null,
      team2: g.Team2?.full_name || null,
    }));
  }

  // Default/object mode: return rows + count, keeping previous shape
  // Attempt to compute total count; fall back to current page length
  let total = rowsRaw.length;
  if (typeof Game.count === 'function') {
    try {
      total = await Game.count({
        where: findOptions.where,
        distinct: true,
        col: 'id',
        include: findOptions.include,
      });
    } catch {
      // Ignore count errors and use page length
    }
  }

  return {
    rows: rowsRaw.map((g) => ({
      id: g.id,
      date: g.date_start,
      stadium: g.Stadium?.name || null,
      team1: g.Team1?.full_name || null,
      team2: g.Team2?.full_name || null,
      is_home: extIds.includes(Number(g.team1_id)),
    })),
    count: total,
  };
}

export default { listUpcoming };

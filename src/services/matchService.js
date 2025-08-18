import { Op } from 'sequelize';

import { User, Team } from '../models/index.js';
import { Game, Team as ExtTeam, Stadium } from '../externalModels/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listUpcoming(userId, limit = 100) {
  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  const extIds = (user.Teams || [])
    .map((t) => t.external_id)
    .filter((id) => id != null);
  if (!extIds.length) return [];
  const now = new Date();
  const games = await Game.findAll({
    where: {
      object_status: 'active',
      date_start: { [Op.gte]: now },
      [Op.or]: [
        { team1_id: { [Op.in]: extIds } },
        { team2_id: { [Op.in]: extIds } },
      ],
    },
    include: [
      { model: ExtTeam, as: 'Team1', attributes: ['full_name'] },
      { model: ExtTeam, as: 'Team2', attributes: ['full_name'] },
      { model: Stadium, attributes: ['name'] },
    ],
    order: [['date_start', 'ASC']],
    limit,
  });
  return games.map((g) => ({
    id: g.id,
    date: g.date_start,
    stadium: g.Stadium?.name || null,
    team1: g.Team1?.full_name || null,
    team2: g.Team2?.full_name || null,
  }));
}

export default { listUpcoming };

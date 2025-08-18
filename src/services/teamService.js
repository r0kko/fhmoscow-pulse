import { Team, User, UserTeam } from '../models/index.js';
import { Team as ExtTeam } from '../externalModels/index.js';
import ServiceError from '../errors/ServiceError.js';

async function syncExternal(actorId = null) {
  const extTeams = await ExtTeam.findAll();
  for (const t of extTeams) {
    await Team.upsert({
      external_id: t.id,
      full_name: t.full_name,
      short_name: t.short_name,
      created_by: actorId,
      updated_by: actorId,
    });
  }
}

async function listAll() {
  return Team.findAll({ order: [['full_name', 'ASC']] });
}

async function listUserTeams(userId) {
  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  return user.Teams || [];
}

async function addUserTeam(userId, teamId, actorId) {
  const [user, team] = await Promise.all([
    User.findByPk(userId),
    Team.findByPk(teamId),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!team) throw new ServiceError('team_not_found', 404);
  await user.addTeam(team, {
    through: { created_by: actorId, updated_by: actorId },
  });
}

async function removeUserTeam(userId, teamId, actorId = null) {
  const [user, team] = await Promise.all([
    User.findByPk(userId),
    Team.findByPk(teamId),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!team) throw new ServiceError('team_not_found', 404);
  const link = await UserTeam.findOne({
    where: { user_id: userId, team_id: teamId },
  });
  if (link) {
    await link.update({ updated_by: actorId });
  }
  await user.removeTeam(team);
}

export default {
  syncExternal,
  listAll,
  listUserTeams,
  addUserTeam,
  removeUserTeam,
};

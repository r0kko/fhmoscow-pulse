import { Op } from 'sequelize';

import { Team, User, UserTeam } from '../models/index.js';
import { Team as ExtTeam } from '../externalModels/index.js';
import ServiceError from '../errors/ServiceError.js';
import sequelize from '../config/database.js';
import logger from '../../logger.js';

async function syncExternal(actorId = null) {
  // Pull only ACTIVE teams from the external DB. Records with object_status = 'archive'
  // are intentionally excluded and treated as removed for our side.
  const extTeams = await ExtTeam.findAll({
    where: { object_status: 'active' },
  });
  const activeIds = extTeams.map((t) => t.id);

  let upserts = 0;

  await sequelize.transaction(async (tx) => {
    // Upsert all active external teams into local DB; ensure un-delete if previously deleted
    for (const t of extTeams) {
      await Team.upsert(
        {
          external_id: t.id,
          name: t.short_name,
          birth_year: t.year,
          deleted_at: null, // restore if was soft-deleted
          created_by: actorId,
          updated_by: actorId,
        },
        { paranoid: false, transaction: tx }
      );
      upserts += 1;
    }

    // Soft-delete (paranoid) any local team that was previously synced (has external_id)
    // but is no longer present among ACTIVE external teams (not found or archived externally).
    const [affected] = await Team.update(
      { deleted_at: new Date(), updated_by: actorId },
      {
        where: {
          external_id: { [Op.notIn]: activeIds, [Op.ne]: null },
        },
        transaction: tx,
      }
    );

    logger.info('Team sync: upserted=%d, softDeleted=%d', upserts, affected);
  });
}

async function listAll() {
  return Team.findAll({ order: [['name', 'ASC']] });
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

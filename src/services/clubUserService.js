import { User, Club, UserClub, Team, UserTeam } from '../models/index.js';
import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';

async function listUserClubs(userId) {
  const user = await User.findByPk(userId, { include: [Club] });
  if (!user) throw new ServiceError('user_not_found', 404);
  return user.Clubs || [];
}

async function addUserClub(userId, clubId, actorId) {
  const [user, club] = await Promise.all([
    User.findByPk(userId),
    Club.findByPk(clubId),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!club) throw new ServiceError('club_not_found', 404);
  await sequelize.transaction(async (tx) => {
    await user.addClub(club, {
      through: { created_by: actorId, updated_by: actorId },
      transaction: tx,
    });
    const teams = await Team.findAll({
      where: { club_id: clubId },
      transaction: tx,
    });
    for (const t of teams) {
      await user.addTeam(t, {
        through: { created_by: actorId, updated_by: actorId },
        transaction: tx,
      });
    }
  });
}

async function removeUserClub(userId, clubId, actorId = null) {
  const [user, club] = await Promise.all([
    User.findByPk(userId),
    Club.findByPk(clubId),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!club) throw new ServiceError('club_not_found', 404);
  await sequelize.transaction(async (tx) => {
    const link = await UserClub.findOne({
      where: { user_id: userId, club_id: clubId },
      transaction: tx,
    });
    if (link) await link.update({ updated_by: actorId }, { transaction: tx });
    await user.removeClub(club, { transaction: tx });
    const teams = await Team.findAll({
      where: { club_id: clubId },
      transaction: tx,
    });
    for (const t of teams) {
      const tlink = await UserTeam.findOne({
        where: { user_id: userId, team_id: t.id },
        transaction: tx,
      });
      if (tlink)
        await tlink.update({ updated_by: actorId }, { transaction: tx });
      await user.removeTeam(t, { transaction: tx });
    }
  });
}

export default { listUserClubs, addUserClub, removeUserClub };

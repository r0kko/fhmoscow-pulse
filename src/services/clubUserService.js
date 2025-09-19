import { User, Club, UserClub, Team, UserTeam, SportSchoolPosition } from '../models/index.js';
import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';

async function listUserClubs(userId, withTeams = false) {
  const clubInclude = {
    model: Club,
    include: [],
  };
  if (withTeams) clubInclude.include.push(Team);
  const memberships = await UserClub.findAll({
    where: { user_id: userId },
    include: [
      clubInclude,
      { model: SportSchoolPosition, as: 'SportSchoolPosition' },
    ],
    order: [['created_at', 'ASC']],
  });
  if (memberships.length === 0) {
    const user = await User.findByPk(userId);
    if (!user) throw new ServiceError('user_not_found', 404);
    return [];
  }
  return memberships
    .map((membership) => {
      const club = membership.Club;
      if (!club) return null;
      if (typeof club.setDataValue === 'function')
        club.setDataValue('UserClub', membership);
      else club.UserClub = membership;
      return club;
    })
    .filter(Boolean);
}

async function addUserClub(userId, clubId, actorId, options = {}) {
  const [user, club] = await Promise.all([
    User.findByPk(userId),
    Club.findByPk(clubId),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!club) throw new ServiceError('club_not_found', 404);
  await sequelize.transaction(async (tx) => {
    // Restore soft-deleted club link if exists
    const existingClubLink = await UserClub.findOne({
      where: { user_id: userId, club_id: clubId },
      paranoid: false,
      transaction: tx,
    });
    const hasPosition = Object.prototype.hasOwnProperty.call(options, 'positionId');
    if (existingClubLink) {
      if (existingClubLink.deletedAt)
        await existingClubLink.restore({ transaction: tx });
      const updates = { updated_by: actorId };
      if (hasPosition)
        updates.sport_school_position_id = options.positionId || null;
      await existingClubLink.update(updates, { transaction: tx });
    } else {
      const through = { created_by: actorId, updated_by: actorId };
      if (hasPosition) through.sport_school_position_id = options.positionId || null;
      await user.addClub(club, {
        through,
        transaction: tx,
      });
    }

    // Attach or restore user to all teams of the club
    const teams = await Team.findAll({
      where: { club_id: clubId },
      transaction: tx,
    });
    for (const t of teams) {
      const existingTeamLink = await UserTeam.findOne({
        where: { user_id: userId, team_id: t.id },
        paranoid: false,
        transaction: tx,
      });
      if (existingTeamLink) {
        if (existingTeamLink.deletedAt)
          await existingTeamLink.restore({ transaction: tx });
        await existingTeamLink.update(
          { updated_by: actorId },
          { transaction: tx }
        );
      } else {
        await user.addTeam(t, {
          through: { created_by: actorId, updated_by: actorId },
          transaction: tx,
        });
      }
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

async function updateClubUserPosition(clubId, userId, positionId, actorId = null) {
  const link = await UserClub.findOne({
    where: { club_id: clubId, user_id: userId },
  });
  if (!link) throw new ServiceError('club_staff_link_not_found', 404);
  await link.update(
    {
      sport_school_position_id: positionId || null,
      updated_by: actorId,
    },
    { returning: false }
  );
  return link;
}

export default { listUserClubs, addUserClub, removeUserClub, updateClubUserPosition };

// New helpers for club-centric staff management
async function listClubUsers(clubId) {
  const club = await Club.findByPk(clubId, {
    include: [
      {
        model: User,
        through: { attributes: ['sport_school_position_id'] },
        required: false,
      },
    ],
  });
  if (!club) throw new ServiceError('club_not_found', 404);
  // Return all users linked to the club; caller can filter by role if needed
  return club.Users || [];
}

async function addClubUser(clubId, userId, actorId, options = {}) {
  // Delegate to user->club to preserve side effects (auto-attach teams)
  return addUserClub(userId, clubId, actorId, options);
}

async function removeClubUser(clubId, userId, actorId = null) {
  // Delegate to user->club removal (also removes team links for club teams)
  return removeUserClub(userId, clubId, actorId);
}

export { listClubUsers, addClubUser, removeClubUser, updateClubUserPosition };

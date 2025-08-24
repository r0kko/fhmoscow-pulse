import sequelize from '../config/database.js';
import { Ground, Club, Team, GroundClub, GroundTeam } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listGroundClubs(groundId) {
  const ground = await Ground.findByPk(groundId, { include: [Club] });
  if (!ground) throw new ServiceError('ground_not_found', 404);
  return ground.Clubs || [];
}

async function listGroundTeams(groundId) {
  const ground = await Ground.findByPk(groundId, { include: [Team] });
  if (!ground) throw new ServiceError('ground_not_found', 404);
  return ground.Teams || [];
}

async function addGroundClub(groundId, clubId, actorId) {
  const [ground, club] = await Promise.all([
    Ground.findByPk(groundId),
    Club.findByPk(clubId),
  ]);
  if (!ground) throw new ServiceError('ground_not_found', 404);
  if (!club) throw new ServiceError('club_not_found', 404);
  await sequelize.transaction(async (tx) => {
    const existing = await GroundClub.findOne({
      where: { ground_id: groundId, club_id: clubId },
      paranoid: false,
      transaction: tx,
    });
    if (existing) {
      if (existing.deletedAt) await existing.restore({ transaction: tx });
      await existing.update({ updated_by: actorId }, { transaction: tx });
    } else {
      await ground.addClub(club, {
        through: { created_by: actorId, updated_by: actorId },
        transaction: tx,
      });
    }

    // Also attach all teams of the club to the ground
    const teams = await Team.findAll({
      where: { club_id: clubId },
      transaction: tx,
    });
    for (const t of teams) {
      const gt = await GroundTeam.findOne({
        where: { ground_id: groundId, team_id: t.id },
        paranoid: false,
        transaction: tx,
      });
      if (gt) {
        if (gt.deletedAt) await gt.restore({ transaction: tx });
        await gt.update({ updated_by: actorId }, { transaction: tx });
      } else {
        await ground.addTeam(t, {
          through: { created_by: actorId, updated_by: actorId },
          transaction: tx,
        });
      }
    }
  });
}

async function removeGroundClub(groundId, clubId, actorId = null) {
  const [ground, club] = await Promise.all([
    Ground.findByPk(groundId),
    Club.findByPk(clubId),
  ]);
  if (!ground) throw new ServiceError('ground_not_found', 404);
  if (!club) throw new ServiceError('club_not_found', 404);
  await sequelize.transaction(async (tx) => {
    const link = await GroundClub.findOne({
      where: { ground_id: groundId, club_id: clubId },
      transaction: tx,
    });
    if (link) await link.update({ updated_by: actorId }, { transaction: tx });
    await ground.removeClub(club, { transaction: tx });

    // Also detach all teams of the club from the ground
    const teams = await Team.findAll({
      where: { club_id: clubId },
      transaction: tx,
    });
    for (const t of teams) {
      const tlink = await GroundTeam.findOne({
        where: { ground_id: groundId, team_id: t.id },
        transaction: tx,
      });
      if (tlink)
        await tlink.update({ updated_by: actorId }, { transaction: tx });
      await ground.removeTeam(t, { transaction: tx });
    }
  });
}

async function addGroundTeam(groundId, teamId, actorId) {
  const [ground, team] = await Promise.all([
    Ground.findByPk(groundId),
    Team.findByPk(teamId),
  ]);
  if (!ground) throw new ServiceError('ground_not_found', 404);
  if (!team) throw new ServiceError('team_not_found', 404);
  await sequelize.transaction(async (tx) => {
    const existing = await GroundTeam.findOne({
      where: { ground_id: groundId, team_id: teamId },
      paranoid: false,
      transaction: tx,
    });
    if (existing) {
      if (existing.deletedAt) await existing.restore({ transaction: tx });
      await existing.update({ updated_by: actorId }, { transaction: tx });
    } else {
      await ground.addTeam(team, {
        through: { created_by: actorId, updated_by: actorId },
        transaction: tx,
      });
    }
  });
}

async function removeGroundTeam(groundId, teamId, actorId = null) {
  const [ground, team] = await Promise.all([
    Ground.findByPk(groundId),
    Team.findByPk(teamId),
  ]);
  if (!ground) throw new ServiceError('ground_not_found', 404);
  if (!team) throw new ServiceError('team_not_found', 404);
  await sequelize.transaction(async (tx) => {
    const link = await GroundTeam.findOne({
      where: { ground_id: groundId, team_id: teamId },
      transaction: tx,
    });
    if (link) await link.update({ updated_by: actorId }, { transaction: tx });
    await ground.removeTeam(team, { transaction: tx });
  });
}

export default {
  listGroundClubs,
  listGroundTeams,
  addGroundClub,
  removeGroundClub,
  addGroundTeam,
  removeGroundTeam,
};

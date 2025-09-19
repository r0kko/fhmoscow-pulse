import {
  Club,
  Team,
  User,
  Role,
  UserClub,
  SportSchoolPosition,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import clubMapper from '../mappers/clubMapper.js';
import teamMapper from '../mappers/teamMapper.js';
import userMapper from '../mappers/userMapper.js';

function toPlain(model) {
  return typeof model?.get === 'function' ? model.get({ plain: true }) : model;
}

function mapPosition(position) {
  if (!position) return null;
  const plain = toPlain(position);
  return { id: plain.id, alias: plain.alias, name: plain.name, description: plain.description };
}

async function getClubStructure(clubId) {
  const club = await Club.findByPk(clubId);
  if (!club) throw new ServiceError('club_not_found', 404);

  const [positions, memberships, teams] = await Promise.all([
    SportSchoolPosition.findAll(),
    UserClub.findAll({
      where: { club_id: clubId },
      include: [
        {
          model: User,
          include: [
            {
              model: Role,
              attributes: ['id', 'alias', 'name'],
              through: { attributes: [] },
            },
          ],
        },
        {
          model: SportSchoolPosition,
          as: 'SportSchoolPosition',
        },
      ],
      order: [['created_at', 'ASC']],
    }),
    Team.findAll({
      where: { club_id: clubId },
      include: [
        {
          model: User,
          include: [
            {
              model: Role,
              attributes: ['id', 'alias', 'name'],
              through: { attributes: [] },
            },
          ],
          through: { attributes: [] },
          required: false,
        },
      ],
      order: [
        ['name', 'ASC'],
        ['birth_year', 'ASC'],
      ],
    }),
  ]);

  const clubPublic = clubMapper.toPublic(club);
  const positionPlain = positions.map((p) => mapPosition(p));
  const positionById = new Map(positionPlain.map((p) => [p.id, p]));

  const teamPlain = teams.map((team) => toPlain(team));
  const teamPublic = teamPlain.map((team) => teamMapper.toPublic(team));

  const staff = [];
  const staffByUserId = new Map();

  memberships.forEach((membershipModel) => {
    const membership = toPlain(membershipModel);
    if (!membership.User) return;
    const roles = membership.User.Roles || [];
    const isStaff = roles.some((role) => role.alias === 'SPORT_SCHOOL_STAFF');
    if (!isStaff) return;
    const userPublic = userMapper.toPublic(membership.User);
    const position = positionById.get(membership.sport_school_position_id || '') || null;
    const entry = {
      user: userPublic,
      position,
      club_id: membership.club_id,
      membership_id: membership.id,
    };
    staff.push(entry);
    staffByUserId.set(userPublic.id, entry);
  });

  const teamStructures = teamPlain.map((team, index) => {
    const staffMembers = (team.Users || []).filter((user) => {
      if (!user) return false;
      if (!staffByUserId.has(user.id)) return false;
      const roles = user.Roles || [];
      return roles.some((role) => role.alias === 'SPORT_SCHOOL_STAFF');
    });
    const staffPublic = staffMembers.map((user) => {
      const publicUser = userMapper.toPublic(user);
      const membership = staffByUserId.get(publicUser.id) || null;
      return {
        user: publicUser,
        position: membership?.position || null,
      };
    });
    return {
      ...teamPublic[index],
      staff: staffPublic,
    };
  });

  return {
    club: clubPublic,
    positions: positionPlain,
    staff,
    teams: teamStructures,
  };
}

export default {
  getClubStructure,
};

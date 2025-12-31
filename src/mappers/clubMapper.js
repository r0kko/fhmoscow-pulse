import teamMapper from './teamMapper.js';

export default {
  toPublic(club) {
    if (!club) return null;
    const out = {
      id: club.id,
      external_id: club.external_id,
      name: club.name,
    };
    if (club.Teams) {
      out.teams = club.Teams.map((t) => teamMapper.toPublic(t));
    }
    if (club.Grounds) {
      out.grounds = club.Grounds.map((g) => ({ id: g.id, name: g.name }));
    }

    const clubMembership =
      club.UserClub ||
      (typeof club.get === 'function' ? club.get('UserClub') : null) ||
      club.dataValues?.UserClub;
    if (clubMembership) {
      const membership =
        typeof clubMembership.get === 'function'
          ? clubMembership.get({ plain: true })
          : clubMembership;
      out.sport_school_position_id =
        membership.sport_school_position_id || null;
      const position =
        membership.SportSchoolPosition ||
        membership.sport_school_position ||
        null;
      const alias =
        position?.alias || membership.sport_school_position_alias || null;
      const name =
        position?.name || membership.sport_school_position_name || null;
      if (alias) out.sport_school_position_alias = alias;
      if (name) out.sport_school_position_name = name;
    }
    return out;
  },
};

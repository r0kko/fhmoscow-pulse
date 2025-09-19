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

    if (club.UserClub) {
      const membership =
        typeof club.UserClub.get === 'function'
          ? club.UserClub.get({ plain: true })
          : club.UserClub;
      out.sport_school_position_id =
        membership.sport_school_position_id || null;
      if (membership.SportSchoolPosition) {
        const position = membership.SportSchoolPosition;
        out.sport_school_position_name = position.name;
        out.sport_school_position_alias = position.alias;
      }
    }
    return out;
  },
};

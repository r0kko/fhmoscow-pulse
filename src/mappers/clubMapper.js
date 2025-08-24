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
    return out;
  },
};

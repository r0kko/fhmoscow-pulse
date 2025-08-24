export default {
  toPublic(team) {
    if (!team) return null;
    const out = {
      id: team.id,
      external_id: team.external_id,
      name: team.name,
      birth_year: team.birth_year,
      club_id: team.club_id || null,
    };
    if (team.Club) {
      out.club = { id: team.Club.id, name: team.Club.name };
    }
    if (team.Grounds) {
      out.grounds = team.Grounds.map((g) => ({ id: g.id, name: g.name }));
    }
    return out;
  },
};

export default {
  toPublic(team) {
    if (!team) return null;
    return {
      id: team.id,
      external_id: team.external_id,
      full_name: team.full_name,
      short_name: team.short_name,
    };
  },
};

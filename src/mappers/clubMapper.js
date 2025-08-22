export default {
  toPublic(club) {
    if (!club) return null;
    return {
      id: club.id,
      external_id: club.external_id,
      name: club.name,
    };
  },
};

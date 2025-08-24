'use strict';

module.exports = {
  async up(queryInterface) {
    // Backfill season_id in team_players from related club_players
    await queryInterface.sequelize.query(`
      UPDATE team_players tp
      SET season_id = cp.season_id
      FROM club_players cp
      WHERE tp.club_player_id = cp.id
        AND tp.season_id IS NULL
        AND cp.season_id IS NOT NULL
    `);
  },
  async down() {
    // no-op: do not unset data on down migration
  },
};

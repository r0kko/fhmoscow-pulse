'use strict';

module.exports = {
  async up(queryInterface) {
    // Backfill season_id in team_staff from related club_staff
    await queryInterface.sequelize.query(`
      UPDATE team_staff ts
      SET season_id = cs.season_id
      FROM club_staff cs
      WHERE ts.club_staff_id = cs.id
        AND ts.season_id IS NULL
        AND cs.season_id IS NOT NULL
    `);
  },
  async down() {
    // no-op: do not unset data on down migration
  },
};

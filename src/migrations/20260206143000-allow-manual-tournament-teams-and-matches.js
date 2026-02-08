'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tournament_teams', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.changeColumn('matches', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      WITH cte AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
        FROM tournament_teams
        WHERE external_id IS NULL
      )
      UPDATE tournament_teams tt
      SET external_id = -4000000 - cte.rn
      FROM cte
      WHERE tt.id = cte.id
    `);

    await queryInterface.sequelize.query(`
      WITH cte AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
        FROM matches
        WHERE external_id IS NULL
      )
      UPDATE matches m
      SET external_id = -5000000 - cte.rn
      FROM cte
      WHERE m.id = cte.id
    `);

    await queryInterface.changeColumn('matches', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.changeColumn('tournament_teams', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};

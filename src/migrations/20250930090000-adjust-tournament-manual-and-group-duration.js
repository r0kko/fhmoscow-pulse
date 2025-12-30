'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tournaments', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.changeColumn('stages', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.changeColumn('tournament_groups', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn(
      'tournament_groups',
      'match_duration_minutes',
      {
        type: Sequelize.INTEGER,
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      'tournament_groups',
      'match_duration_minutes'
    );
    await queryInterface.sequelize.query(`
      WITH cte AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
        FROM tournaments
        WHERE external_id IS NULL
      )
      UPDATE tournaments t
      SET external_id = -1000000 - cte.rn
      FROM cte
      WHERE t.id = cte.id
    `);
    await queryInterface.sequelize.query(`
      WITH cte AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
        FROM stages
        WHERE external_id IS NULL
      )
      UPDATE stages s
      SET external_id = -2000000 - cte.rn
      FROM cte
      WHERE s.id = cte.id
    `);
    await queryInterface.sequelize.query(`
      WITH cte AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
        FROM tournament_groups
        WHERE external_id IS NULL
      )
      UPDATE tournament_groups g
      SET external_id = -3000000 - cte.rn
      FROM cte
      WHERE g.id = cte.id
    `);
    await queryInterface.changeColumn('tournament_groups', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.changeColumn('stages', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.changeColumn('tournaments', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};

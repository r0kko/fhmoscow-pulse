'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
    );

    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS teams_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS clubs_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS tournaments_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS tournament_groups_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS grounds_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS tours_name_trgm_idx;'
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX teams_name_trgm_idx
      ON teams USING gin (name gin_trgm_ops)
      WHERE name IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX clubs_name_trgm_idx
      ON clubs USING gin (name gin_trgm_ops)
      WHERE name IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX tournaments_name_trgm_idx
      ON tournaments USING gin (name gin_trgm_ops)
      WHERE name IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX tournament_groups_name_trgm_idx
      ON tournament_groups USING gin (name gin_trgm_ops)
      WHERE name IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX grounds_name_trgm_idx
      ON grounds USING gin (name gin_trgm_ops)
      WHERE name IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX tours_name_trgm_idx
      ON tours USING gin (name gin_trgm_ops)
      WHERE name IS NOT NULL;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS tours_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS grounds_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS tournament_groups_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS tournaments_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS clubs_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS teams_name_trgm_idx;'
    );
  },
};

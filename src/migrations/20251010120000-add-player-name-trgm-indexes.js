'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS players_surname_trgm_idx
      ON players USING gin (lower(surname) gin_trgm_ops)
      WHERE surname IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS players_name_trgm_idx
      ON players USING gin (lower(name) gin_trgm_ops)
      WHERE name IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS players_patronymic_trgm_idx
      ON players USING gin (lower(patronymic) gin_trgm_ops)
      WHERE patronymic IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS players_full_name_trgm_idx
      ON players USING gin (
        lower(
          trim(
            both ' ' from (
              coalesce(surname, '') || ' ' ||
              coalesce(name, '') || ' ' ||
              coalesce(patronymic, '')
            )
          )
        ) gin_trgm_ops
      );
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS players_full_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS players_patronymic_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS players_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS players_surname_trgm_idx;'
    );
  },
};

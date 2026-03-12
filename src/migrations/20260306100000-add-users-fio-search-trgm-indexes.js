'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS users_last_name_trgm_idx
      ON users USING gin ((replace(lower(last_name), 'ё', 'е')) gin_trgm_ops)
      WHERE deleted_at IS NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS users_first_name_trgm_idx
      ON users USING gin ((replace(lower(first_name), 'ё', 'е')) gin_trgm_ops)
      WHERE deleted_at IS NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS users_patronymic_trgm_idx
      ON users USING gin ((replace(lower(patronymic), 'ё', 'е')) gin_trgm_ops)
      WHERE deleted_at IS NULL AND patronymic IS NOT NULL;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS users_patronymic_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS users_first_name_trgm_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS users_last_name_trgm_idx;'
    );
  },
};

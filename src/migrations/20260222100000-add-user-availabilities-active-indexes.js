'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, date
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
          ) AS rn
        FROM user_availabilities
        WHERE deleted_at IS NULL
      )
      UPDATE user_availabilities ua
      SET deleted_at = NOW(), updated_at = NOW()
      FROM ranked r
      WHERE ua.id = r.id
        AND r.rn > 1
    `);

    await queryInterface.addIndex('user_availabilities', ['user_id', 'date'], {
      name: 'uq_user_availabilities_user_date_active',
      unique: true,
      where: { deleted_at: null },
    });

    await queryInterface.addIndex('user_availabilities', ['date'], {
      name: 'idx_user_availabilities_date_active',
      where: { deleted_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'user_availabilities',
      'idx_user_availabilities_date_active'
    );

    await queryInterface.removeIndex(
      'user_availabilities',
      'uq_user_availabilities_user_date_active'
    );
  },
};

'use strict';

// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // already seeded? (проверяем по alias)
    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS cnt
             FROM roles
             WHERE alias IN ('ADMIN', 'REFEREE');`
    );
    if (Number(existing[0].cnt) > 0) return;

    await queryInterface.bulkInsert(
      'roles',
      [
        {
          id: uuidv4(),
          name: 'Admin',
          alias: 'ADMIN',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Referee',
          alias: 'REFEREE',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true } // PG → ON CONFLICT DO NOTHING
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', { alias: ['ADMIN', 'REFEREE'] });
  },
};

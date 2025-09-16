'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS cnt
             FROM user_statuses
             WHERE alias IN ('ACTIVE', 'INACTIVE');`
    );
    if (Number(existing[0].cnt) > 0) return;

    await queryInterface.bulkInsert(
      'user_statuses',
      [
        {
          id: randomUUID(),
          name: 'Active',
          alias: 'ACTIVE',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Inactive',
          alias: 'INACTIVE',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('user_statuses', {
      alias: ['ACTIVE', 'INACTIVE'],
    });
  },
};

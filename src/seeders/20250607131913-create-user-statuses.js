'use strict';

const { v4: uuidv4 } = require('uuid');

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
          id: uuidv4(),
          name: 'Active',
          alias: 'ACTIVE',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
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

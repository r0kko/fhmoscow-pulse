'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM user_statuses WHERE alias = 'AWAITING_CONFIRMATION';"
    );
    if (Number(existing[0].cnt) > 0) return;
    const now = new Date();
    await queryInterface.bulkInsert(
      'user_statuses',
      [
        {
          id: randomUUID(),
          name: 'Awaiting confirmation',
          alias: 'AWAITING_CONFIRMATION',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('user_statuses', {
      alias: 'AWAITING_CONFIRMATION',
    });
  },
};

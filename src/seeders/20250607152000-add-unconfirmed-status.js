'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM user_statuses WHERE alias = 'EMAIL_UNCONFIRMED';"
    );
    if (Number(existing[0].cnt) > 0) return;
    const now = new Date();
    await queryInterface.bulkInsert(
      'user_statuses',
      [
        {
          id: randomUUID(),
          name: 'Email unconfirmed',
          alias: 'EMAIL_UNCONFIRMED',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('user_statuses', {
      alias: ['EMAIL_UNCONFIRMED'],
    });
  },
};

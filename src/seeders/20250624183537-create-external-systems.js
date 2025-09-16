'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM external_systems WHERE alias = 'HOCKEYMOS';"
    );
    if (Number(existing[0].cnt) > 0) return;

    await queryInterface.bulkInsert(
      'external_systems',
      [
        {
          id: randomUUID(),
          name: 'Личный кабинет судьи',
          alias: 'HOCKEYMOS',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('external_systems', { alias: 'HOCKEYMOS' });
  },
};

'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      `SELECT COUNT(*) AS cnt FROM countries WHERE alias = 'RU';`
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'countries',
      [
        {
          id: randomUUID(),
          name: 'Российская Федерация',
          alias: 'RU',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('countries', { alias: 'RU' });
  },
};

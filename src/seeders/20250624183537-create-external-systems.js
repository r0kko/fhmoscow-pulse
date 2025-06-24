'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM external_systems WHERE alias = "HOCKEYMOS";'
    );
    if (Number(existing[0].cnt) > 0) return;

    await queryInterface.bulkInsert(
      'external_systems',
      [
        {
          id: uuidv4(),
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

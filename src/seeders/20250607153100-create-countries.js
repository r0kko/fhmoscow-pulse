'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS cnt FROM countries WHERE alias = 'RU';`
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'countries',
      [
        { id: uuidv4(), name: 'Российская Федерация', alias: 'RU', created_at: now, updated_at: now },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('countries', { alias: 'RU' });
  },
};

'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM seasons WHERE alias IN (\'2024\', \'2025\');'
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'seasons',
      [
        {
          id: uuidv4(),
          name: '2024 год',
          alias: '2024',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: '2025 год',
          alias: '2025',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('seasons', { alias: ['2024', '2025'] });
  },
};

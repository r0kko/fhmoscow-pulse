'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM seasons WHERE alias IN ('2024', '2025');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'seasons',
      [
        {
          id: randomUUID(),
          name: '2024 год',
          alias: '2024',
          active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: '2025 год',
          alias: '2025',
          active: false,
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

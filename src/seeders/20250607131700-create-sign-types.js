'use strict';

/** @type {import('sequelize-cli').Migration} */

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS cnt
         FROM sign_types
         WHERE alias IN ('HANDWRITTEN', 'KONTUR_SIGN', 'SIMPLE_ELECTRONIC');`
    );
    if (Number(existing[0].cnt) > 0) return;

    await queryInterface.bulkInsert(
      'sign_types',
      [
        {
          id: randomUUID(),
          name: 'Собственноручная',
          alias: 'HANDWRITTEN',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Через Контур.Сайн',
          alias: 'KONTUR_SIGN',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Простая электронная подпись',
          alias: 'SIMPLE_ELECTRONIC',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('sign_types', {
      alias: ['HANDWRITTEN', 'KONTUR_SIGN', 'SIMPLE_ELECTRONIC'],
    });
  },
};

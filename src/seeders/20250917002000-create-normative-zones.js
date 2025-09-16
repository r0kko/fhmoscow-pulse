'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM normative_zones;'
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'normative_zones',
      [
        {
          id: randomUUID(),
          name: 'Зеленая',
          alias: 'GREEN',
          color: 'green',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Желтая',
          alias: 'YELLOW',
          color: 'yellow',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Красная',
          alias: 'RED',
          color: 'red',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('normative_zones', {
      alias: ['GREEN', 'YELLOW', 'RED'],
    });
  },
};

'use strict';

const { v4: uuidv4 } = require('uuid');

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
          id: uuidv4(),
          name: 'Зеленая',
          alias: 'GREEN',
          color: 'green',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Желтая',
          alias: 'YELLOW',
          color: 'yellow',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
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

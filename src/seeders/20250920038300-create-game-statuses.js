'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM game_statuses WHERE alias IN ('SCHEDULED','POSTPONED','CANCELLED','LIVE','FINISHED');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'game_statuses',
      [
        {
          id: uuidv4(),
          name: 'По расписанию',
          alias: 'SCHEDULED',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Перенесен',
          alias: 'POSTPONED',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Отменён',
          alias: 'CANCELLED',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Идёт',
          alias: 'LIVE',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Состоялся',
          alias: 'FINISHED',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('game_statuses', {
      alias: ['SCHEDULED', 'POSTPONED', 'CANCELLED', 'LIVE', 'FINISHED'],
    });
  },
};

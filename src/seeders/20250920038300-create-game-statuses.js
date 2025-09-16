'use strict';

const { randomUUID } = require('crypto');

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
          id: randomUUID(),
          name: 'По расписанию',
          alias: 'SCHEDULED',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Перенесен',
          alias: 'POSTPONED',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Отменён',
          alias: 'CANCELLED',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Идёт',
          alias: 'LIVE',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
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

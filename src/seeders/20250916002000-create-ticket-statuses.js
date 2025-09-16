'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM ticket_statuses WHERE alias IN ('CREATED','IN_PROGRESS','CONFIRMED','REJECTED');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'ticket_statuses',
      [
        {
          id: randomUUID(),
          name: 'Создан',
          alias: 'CREATED',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'В работе',
          alias: 'IN_PROGRESS',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Подтвержден',
          alias: 'CONFIRMED',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Отклонен',
          alias: 'REJECTED',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('ticket_statuses', {
      alias: ['CREATED', 'IN_PROGRESS', 'CONFIRMED', 'REJECTED'],
    });
  },
};

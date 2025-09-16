'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM task_statuses WHERE alias IN ('PENDING','IN_PROGRESS','COMPLETED');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'task_statuses',
      [
        {
          id: randomUUID(),
          name: 'В ожидании',
          alias: 'PENDING',
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
          name: 'Завершена',
          alias: 'COMPLETED',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('task_statuses', {
      alias: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
    });
  },
};

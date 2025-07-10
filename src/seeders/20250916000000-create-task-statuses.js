'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

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
          id: uuidv4(),
          name: 'В ожидании',
          alias: 'PENDING',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'В работе',
          alias: 'IN_PROGRESS',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
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

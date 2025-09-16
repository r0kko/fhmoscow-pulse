'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM medical_exam_registration_statuses WHERE alias IN ('PENDING','APPROVED','CANCELED','COMPLETED');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'medical_exam_registration_statuses',
      [
        {
          id: randomUUID(),
          name: 'На рассмотрении',
          alias: 'PENDING',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Подтверждена',
          alias: 'APPROVED',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Отменена',
          alias: 'CANCELED',
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
    await queryInterface.bulkDelete('medical_exam_registration_statuses', {
      alias: ['PENDING', 'APPROVED', 'CANCELED', 'COMPLETED'],
    });
  },
};

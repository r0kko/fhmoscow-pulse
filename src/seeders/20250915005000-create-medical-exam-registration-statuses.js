'use strict';

// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS cnt FROM medical_exam_registration_statuses WHERE alias IN ('PENDING','APPROVED','CANCELED','COMPLETED');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'medical_exam_registration_statuses',
      [
        { id: uuidv4(), name: 'На рассмотрении', alias: 'PENDING', created_at: now, updated_at: now },
        { id: uuidv4(), name: 'Подтверждена', alias: 'APPROVED', created_at: now, updated_at: now },
        { id: uuidv4(), name: 'Отменена', alias: 'CANCELED', created_at: now, updated_at: now },
        { id: uuidv4(), name: 'Завершена', alias: 'COMPLETED', created_at: now, updated_at: now },
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

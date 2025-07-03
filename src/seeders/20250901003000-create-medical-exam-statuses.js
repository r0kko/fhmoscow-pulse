'use strict';

// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM medical_exam_statuses WHERE alias IN ('OPEN','FINAL_CALL','CLOSED');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'medical_exam_statuses',
      [
        {
          id: uuidv4(),
          name: 'Регистрация открыта',
          alias: 'OPEN',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Регистрация завершается',
          alias: 'FINAL_CALL',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Регистрация закрыта',
          alias: 'CLOSED',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('medical_exam_statuses', {
      alias: ['OPEN', 'FINAL_CALL', 'CLOSED'],
    });
  },
};

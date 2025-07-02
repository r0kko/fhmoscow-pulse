'use strict';

// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM training_statuses WHERE alias IN (\'SCHEDULED\',\'REGISTRATION_OPEN\',\'FINAL_CALL\',\'REGISTRATION_CLOSED\',\'COMPLETED\');'
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'training_statuses',
      [
        { id: uuidv4(), name: 'Назначена', alias: 'SCHEDULED', created_at: now, updated_at: now },
        { id: uuidv4(), name: 'Идет регистрация', alias: 'REGISTRATION_OPEN', created_at: now, updated_at: now },
        { id: uuidv4(), name: 'Final call', alias: 'FINAL_CALL', created_at: now, updated_at: now },
        { id: uuidv4(), name: 'Регистрация закрыта', alias: 'REGISTRATION_CLOSED', created_at: now, updated_at: now },
        { id: uuidv4(), name: 'Тренировка завершена', alias: 'COMPLETED', created_at: now, updated_at: now },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('training_statuses', {
      alias: ['SCHEDULED','REGISTRATION_OPEN','FINAL_CALL','REGISTRATION_CLOSED','COMPLETED'],
    });
  },
};

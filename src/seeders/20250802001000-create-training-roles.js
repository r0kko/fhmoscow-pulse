'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM training_roles WHERE alias IN (\'PARTICIPANT\',\'COACH\',\'EQUIPMENT_MANAGER\');'
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'training_roles',
      [
        {
          id: uuidv4(),
          name: 'Участник',
          alias: 'PARTICIPANT',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Тренер',
          alias: 'COACH',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Ответственный за инвентарь',
          alias: 'EQUIPMENT_MANAGER',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('training_roles', {
      alias: ['PARTICIPANT', 'COACH', 'EQUIPMENT_MANAGER'],
    });
  },
};

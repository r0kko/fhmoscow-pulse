'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM training_roles WHERE alias IN ('PARTICIPANT','COACH','EQUIPMENT_MANAGER');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'training_roles',
      [
        {
          id: uuidv4(),
          name: 'Участник',
          alias: 'PARTICIPANT',
          teacher: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Тренер',
          alias: 'COACH',
          teacher: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Ответственный за инвентарь',
          alias: 'EQUIPMENT_MANAGER',
          teacher: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Преподаватель',
          alias: 'TEACHER',
          teacher: true,
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('training_roles', {
      alias: ['PARTICIPANT', 'COACH', 'EQUIPMENT_MANAGER', 'TEACHER'],
    });
  },
};

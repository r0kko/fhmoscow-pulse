'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'training_roles',
      [
        {
          id: uuidv4(),
          name: 'Участник',
          alias: 'PARTICIPANT',
          for_camp: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Тренер',
          alias: 'COACH',
          for_camp: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Ответственный за инвентарь',
          alias: 'EQUIPMENT_MANAGER',
          for_camp: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Слушатель',
          alias: 'LISTENER',
          for_camp: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Преподаватель',
          alias: 'TEACHER',
          for_camp: false,
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('training_roles', {
      alias: [
        'PARTICIPANT',
        'COACH',
        'EQUIPMENT_MANAGER',
        'LISTENER',
        'TEACHER',
      ],
    });
  },
};

'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const roles = [
      {
        id: uuidv4(),
        name: 'Admin',
        alias: 'ADMIN',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Referee',
        alias: 'REFEREE',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Судья в бригаде',
        alias: 'BRIGADE_REFEREE',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Специалист по судейству (судьи в поле)',
        alias: 'FIELD_REFEREE_SPECIALIST',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Специалист по судейству (судьи в бригаде)',
        alias: 'BRIGADE_REFEREE_SPECIALIST',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Сотрудник спортивной школы',
        alias: 'SPORT_SCHOOL_STAFF',
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('roles', roles, {
      ignoreDuplicates: true, // PG → ON CONFLICT DO NOTHING
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', {
      alias: [
        'ADMIN',
        'REFEREE',
        'BRIGADE_REFEREE',
        'FIELD_REFEREE_SPECIALIST',
        'BRIGADE_REFEREE_SPECIALIST',
        'SPORT_SCHOOL_STAFF',
      ],
    });
  },
};
